// Static check that every query on the per-user tables (progress, progress_event, user_settings,
// export_token) is scoped to a user. Used by
// tests/unit/isolation-guard.test.ts on the app's own files, and on small bad examples (the
// reviewer's probes among them) to prove it catches them. It reads code with the TypeScript
// parser; nothing is run.
//
// Rules:
// 1. Only allow-listed files may import the Drizzle table objects (`progress`, `progressEvent`)
//    or write SQL that names the tables. No file may reach them through the relational API
//    (`db.query.progress`); db/client.ts also leaves them out of Drizzle's schema.
// 2. A table object may only appear as the direct argument of `.from()`, `.update()`, `.delete()`
//    or `.insert()`, or in a column reference (`progress.userId`) or a type. Anything else
//    (`${progress}` in SQL, joins, `$count`, `const t = progress`) is flagged.
// 3. Drizzle queries run inside a function with a `userId` parameter, and:
//    - select, update and delete have exactly one `.where()` whose argument is
//      `eq(<table>.userId, userId)`, or an `and(...)` holding it at the top level (never `or`);
//    - inserts set `userId: userId`; updates and upserts never set `userId`;
//    - no `$dynamic()` (it allows adding conditions out of sight).
// 4. SQL text: each `from`, `update`, `delete from` and `join` of a table has a `where` clause with
//    `user_id = $n` or `user_id = ${userId}` at its top level and no top-level `or`; each
//    `insert into t (...)` lists `user_id`; each `on conflict (...)` names `user_id`; no `set`
//    assigns `user_id`. In the data layer, SQL that names a table is sent from a function with a
//    `userId` parameter, and the call passes `userId`.
// 5. In the allowed TypeScript files, exported functions (declarations, arrow functions, and
//    functions wrapped in a call such as `cache(...)`) that take a database (`Db`) take
//    `userId: string` as their required first argument, except pure helpers in PURE_EXPORTS.
// 6. Admin modules (`adminFiles`, M4b) read across users on purpose, so rules 3 and 4 don't apply
//    to them. Instead:
//    - every exported function starts with `await requirePermission(…)` (as a statement, or as the
//      initializer of its first `const`), so nothing in the module runs before the permission check;
//    - SQL naming a per-user table sits inside one of the module's reviewed functions (listed by
//      name with the file), and names only progress or progress_event, never their note or link
//      columns: counts and dates only;
//    - the module imports no table object for a per-user table (raw SQL only, so all of it is seen).
import ts from "typescript";

export const TABLE_OBJECTS = ["progress", "progressEvent", "userSettings", "exportToken"] as const;
export const TABLE_NAMES = ["progress", "progress_event", "user_settings", "export_token"] as const;
const TABLE_KEYS: readonly string[] = [...TABLE_OBJECTS, ...TABLE_NAMES];

export interface GuardOptions {
  /** Files (relative paths) allowed to touch the tables at all. */
  allowed: ReadonlySet<string>;
  /** Allowed files whose SQL needn't come from a function with a `userId` parameter (test seeds). */
  seedFiles?: ReadonlySet<string>;
  /**
   * Reviewed statements that read across users on purpose (counts only, never notes or links),
   * matched exactly, per file. Each one needs a reason where it is listed.
   */
  reviewed?: ReadonlyMap<string, readonly string[]>;
  /**
   * Admin modules (rule 6): file → the names of its functions reviewed to read per-user tables
   * across users (counts only). Every exported function there must check a permission first.
   */
  adminFiles?: ReadonlyMap<string, readonly string[]>;
}

export interface Finding {
  file: string;
  line: number;
  problem: string;
}

// ---- SQL text

const TABLE_ALTERNATION = "progress_event|progress|user_settings|export_token";
const TABLE_REF_SOURCE = String.raw`\b(from|into|update|join)\s+(?:"public"\.)?"?(${TABLE_ALTERNATION})"?(?![\w."])`;
/** A fresh regex each time: a shared global one carries `lastIndex` between calls. */
const tableRefs = () => new RegExp(TABLE_REF_SOURCE, "gi");

/**
 * Each `on conflict (…)` with the table its insert writes to: the nearest `insert into` before it.
 * `table` is null when that isn't a plain name (a `${…}` placeholder, say), which counts as a
 * per-user table, to be safe.
 */
function conflicts(text: string): { table: string | null; target: string }[] {
  const out: { table: string | null; target: string }[] = [];
  for (const m of text.matchAll(/\bon\s+conflict\s*(?:\(([^)]*)\))?/gi)) {
    const before = text.slice(0, m.index ?? 0);
    const inserts = [...before.matchAll(/\binsert\s+into\s+(\S+)/gi)];
    const raw = inserts.at(-1)?.[1] ?? "";
    const plain = /^(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?(?:\(|$)/i.exec(raw);
    out.push({ table: plain ? plain[1].toLowerCase() : null, target: m[1] ?? "" });
  }
  return out;
}
const PER_USER = new Set<string>(["progress_event", "progress", "user_settings", "export_token"]);
/** An `on conflict` on a per-user table (or one whose table can't be told). */
const perUserConflicts = (text: string) => conflicts(text).filter((c) => c.table === null || PER_USER.has(c.table));
const mentionsTable = (text: string) => tableRefs().test(text) || perUserConflicts(text).length > 0;

/** Clause keywords that end a `where` clause at its own level. */
const CLAUSE_END = /^(returning|order\s+by|group\s+by|having|limit|offset|union|intersect|except|window|for\s+(update|share)|on\s+conflict)\b/i;
/** The user filter: `user_id = $1` or `user_id = ${userId}`, optionally qualified and quoted. */
const USER_FILTER = /(^|[^\w."])(?:"?[a-z_]+"?\.)?"?user_id"?\s*=\s*(?:\$\d+|\$\{userId\})(?![\w])/i;

/**
 * The text of a clause at its own nesting level: nested parentheses become `(…)`. Stops at the end
 * of the text, at a `)` that closes an outer level (the end of a sub-query), or at `stop`.
 */
function topLevel(text: string, stop?: RegExp): { flat: string; length: number } {
  let depth = 0;
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "$" && text[i + 1] === "{") {
      // A template placeholder: keep it whole.
      const close = text.indexOf("}", i);
      const part = close === -1 ? text.slice(i) : text.slice(i, close + 1);
      if (depth === 0) flat += part;
      i += part.length - 1;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) flat += "(";
      depth += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) return { flat, length: i };
      depth -= 1;
      if (depth === 0) flat += "…)";
      continue;
    }
    if (depth === 0) {
      if (stop && /\s/.test(text[i - 1] ?? " ") && stop.test(text.slice(i))) return { flat, length: i };
      flat += ch;
    }
  }
  return { flat, length: text.length };
}

/** The parenthesis depth at `index` (template placeholders ignored). */
function depthAt(text: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === "$" && text[i + 1] === "{") {
      const close = text.indexOf("}", i);
      i = close === -1 ? index : close;
    } else if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
  }
  return depth;
}

/** `where (a and b)` is `where a and b`: unwrap a clause that is one parenthesised group. */
function unwrapWhere(clause: string): string {
  let current = clause.trim();
  while (current.startsWith("(")) {
    const inner = topLevel(current.slice(1));
    if (inner.length !== current.length - 2) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

/** Splits a values list at its top level: `($1, now(), $2)` → ["$1", "now()", "$2"]. */
function topLevelItems(inner: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      items.push(current.trim());
      current = "";
    } else current += ch;
  }
  items.push(current.trim());
  return items;
}

/**
 * What the SQL binds to user_id: the right-hand side of every `user_id = …` and the value in the
 * user_id position of every `insert … (cols) values (…)`. Each must be the user's id, as
 * `${userId}` in a sql`` template or `$n` with `userId` as parameter n (checked by the caller).
 */
export function userIdBindings(text: string): string[] {
  const bindings = [...text.matchAll(/"?user_id"?\s*=\s*(\$\d+|\$\{[^}]*\})/gi)].map((m) => m[1]);
  for (const m of text.matchAll(new RegExp(String.raw`\binto\s+(?:"public"\.)?"?(?:${TABLE_ALTERNATION})"?\s*\(([^)]*)\)\s*values\s*\(`, "gi"))) {
    const cols = m[1].split(",").map((c) => c.trim().replaceAll('"', ""));
    const start = (m.index ?? 0) + m[0].length;
    const values = topLevelItems(text.slice(start, start + topLevel(text.slice(start)).length));
    const at = cols.indexOf("user_id");
    if (at >= 0) bindings.push(values[at] ?? "");
  }
  // insert … (cols) select a, b from source: user_id must be the user's id, or the source's own
  // user_id column (a source that is itself filtered, such as the upsert's returned row).
  for (const m of text.matchAll(new RegExp(String.raw`\binto\s+(?:"public"\.)?"?(?:${TABLE_ALTERNATION})"?\s*\(([^)]*)\)\s*select\b([\s\S]*?)\bfrom\b`, "gi"))) {
    const cols = m[1].split(",").map((c) => c.trim().replaceAll('"', ""));
    const at = cols.indexOf("user_id");
    const item = at >= 0 ? (topLevelItems(m[2])[at] ?? "") : null;
    if (item !== null && !/^(?:"?\w+"?\.)?"?user_id"?$/.test(item)) bindings.push(item);
  }
  return bindings;
}

/** Problems in one piece of SQL text. */
export function checkSqlText(text: string): string[] {
  const problems: string[] = [];
  const refs = [...text.matchAll(tableRefs())];
  refs.forEach((m, i) => {
    const keyword = m[1].toLowerCase();
    const table = m[2];
    const start = (m.index ?? 0) + m[0].length;
    const end = refs[i + 1]?.index ?? text.length;
    const rest = text.slice(start, end);
    if (keyword === "into") {
      const cols = /^\s*\(([^)]*)\)/.exec(rest);
      if (!cols || !/"?user_id"?/.test(cols[1])) problems.push(`insert into ${table} without a user_id column`);
      return;
    }
    // This statement's own level: up to the end of the sub-query it sits in, if any.
    const own = rest.slice(0, topLevel(rest).length);
    if (keyword === "update") {
      const set = /\bset\b([\s\S]*?)(\bwhere\b|$)/i.exec(own);
      if (set && /"?user_id"?\s*=/.test(topLevel(set[1]).flat)) problems.push(`update ${table} sets user_id`);
    }
    // This statement's own where: the first one outside any parentheses.
    const where = [...own.matchAll(/\bwhere\b/gi)].find((w) => depthAt(own, w.index ?? 0) === 0);
    if (!where) {
      problems.push(`${keyword} ${table} without a where clause`);
      return;
    }
    const after = own.slice((where.index ?? 0) + 5);
    const clause = unwrapWhere(after.slice(0, topLevel(after, CLAUSE_END).length));
    const flat = topLevel(clause).flat;
    if (!USER_FILTER.test(flat)) problems.push(`${keyword} ${table} without a top-level user_id = $n condition`);
    if (/\bor\b/i.test(flat)) problems.push(`${keyword} ${table} has a top-level or in its where clause`);
  });
  for (const c of perUserConflicts(text)) {
    if (!/user_id/.test(c.target)) problems.push("on conflict without user_id in its target");
  }
  for (const binding of userIdBindings(text)) {
    if (!/^(\$\d+|\$\{userId\})$/.test(binding)) problems.push(`user_id is bound to ${binding || "nothing"}, not the user's id`);
  }
  for (const m of text.matchAll(/\bdo\s+update\s+set\b([\s\S]*?)(?=\bwhere\b|\breturning\b|$)/gi)) {
    if (/"?user_id"?\s*=/.test(m[1])) problems.push("on conflict do update sets user_id");
  }
  return problems;
}

// ---- TypeScript and JavaScript

const lineOf = (sf: ts.SourceFile, node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/** A template or string literal's text, with `${expr}` kept as written. */
function literalText(sf: ts.SourceFile, node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1);
  return null;
}

/** The outermost expression of a method chain such as db.select().from(t).where(...).limit(1). */
function chainTop(node: ts.Node): ts.Node {
  let current = node;
  while (
    current.parent &&
    ((ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current) ||
      (ts.isCallExpression(current.parent) && current.parent.expression === current) ||
      ts.isNonNullExpression(current.parent))
  ) {
    current = current.parent;
  }
  return current;
}

/** Every call in a chain, by method name: `.where(...)` → ["where", args]. */
function chainCalls(top: ts.Node): { name: string; args: readonly ts.Expression[] }[] {
  const calls: { name: string; args: readonly ts.Expression[] }[] = [];
  let node: ts.Node = top;
  while (true) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      calls.push({ name: node.expression.name.text, args: node.arguments });
      node = node.expression.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isNonNullExpression(node)) {
      node = node.expression;
      continue;
    }
    break;
  }
  return calls;
}

const callName = (node: ts.Node): string | null => {
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
};

/** `eq(<table>.userId, userId)`, or `and(...)` holding it directly (nested `and` included). */
function isScopedCondition(sf: ts.SourceFile, node: ts.Expression, table: string): boolean {
  const name = callName(node);
  if (!name || !ts.isCallExpression(node)) return false;
  if (name === "eq") {
    const [column, value] = node.arguments;
    return column?.getText(sf) === `${table}.userId` && !!value && ts.isIdentifier(value) && value.text === "userId";
  }
  if (name === "and") return node.arguments.some((a) => isScopedCondition(sf, a, table));
  return false;
}

const objectKeys = (sf: ts.SourceFile, node: ts.Node | undefined): Map<string, ts.Node> | null => {
  if (!node || !ts.isObjectLiteralExpression(node)) return null;
  const keys = new Map<string, ts.Node>();
  for (const p of node.properties) {
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name) keys.set(p.name.getText(sf), p);
    else if (ts.isSpreadAssignment(p)) keys.set("...", p);
  }
  return keys;
};

type AnyFunction = ts.FunctionLikeDeclaration;

function enclosingFunction(node: ts.Node): AnyFunction | null {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

const hasUserIdParam = (fn: AnyFunction | null) => !!fn && fn.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === "userId");

/** Is this identifier a reference to a value (not a property name, a key or a declaration)? */
function isReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
  if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === id) return false;
  return true;
}

/** Inside a type (`typeof progress.$inferSelect`): no query can run there. */
function inType(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isTypeNode(current)) return true;
  }
  return false;
}

const PURE_EXPORTS = new Set(["toEntry"]);
const TABLE_METHODS = new Set(["from", "update", "delete", "insert"]);

/** Checks one file. `rel` is its path relative to web/. */
export function checkSource(rel: string, source: string, { allowed, seedFiles = new Set(), reviewed = new Map(), adminFiles = new Map() }: GuardOptions): Finding[] {
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, scriptKind(rel));
  const findings: Finding[] = [];
  const add = (node: ts.Node, problem: string) => findings.push({ file: rel, line: lineOf(sf, node), problem });
  const isAllowed = allowed.has(rel);
  const adminReviewed = adminFiles.get(rel);
  const isAdmin = adminReviewed !== undefined;
  /** Local names of the table objects imported in this file. */
  const tables = new Set<string>();
  /** Variable initializers by name, to follow `db.query(UPSERT, ...)` and `db.execute(query)`. */
  const initializers = new Map<string, ts.Expression>();
  const collectDeclarations = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) initializers.set(n.name.text, n.initializer);
    ts.forEachChild(n, collectDeclarations);
  };
  collectDeclarations(sf);
  /** The SQL an expression can stand for (both branches of a conditional, joined). */
  const resolveSql = (expr: ts.Expression, seen = new Set<string>()): string | null => {
    if (ts.isParenthesizedExpression(expr)) return resolveSql(expr.expression, seen);
    if (ts.isTaggedTemplateExpression(expr)) return literalText(sf, expr.template);
    if (ts.isTemplateExpression(expr)) {
      // Expand `${INSERT}`-style pieces that are themselves SQL constants.
      let text = expr.head.text;
      for (const span of expr.templateSpans) {
        const inner = ts.isIdentifier(span.expression) ? resolveSql(span.expression, seen) : null;
        text += (inner ?? `\${${span.expression.getText(sf)}}`) + span.literal.text;
      }
      return text;
    }
    if (ts.isConditionalExpression(expr)) {
      const parts = [resolveSql(expr.whenTrue, seen), resolveSql(expr.whenFalse, seen)].filter((x) => x !== null);
      return parts.length ? parts.join("\n;\n") : null;
    }
    if (ts.isIdentifier(expr)) {
      const init = initializers.get(expr.text);
      if (!init || seen.has(expr.text)) return null;
      return resolveSql(init, new Set([...seen, expr.text]));
    }
    return literalText(sf, expr);
  };

  // First pass: imports and constants.
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && /(^@\/db\/schema$|\/db\/schema(\.ts)?$)/.test(statement.moduleSpecifier.text)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) add(statement, "imports the schema as a namespace, which hides table use from this check");
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if (!(TABLE_OBJECTS as readonly string[]).includes(imported)) continue;
          tables.add(el.name.text);
          if (isAdmin) add(el, `imports the ${imported} table: admin modules use reviewed SQL only`);
          else if (!isAllowed) add(el, `imports the ${imported} table: only ${[...allowed].join(", ")} may query it`);
          if (el.propertyName) add(el, `renames the ${imported} table on import, which hides it from this check`);
        }
      }
    }
  }

  const visit = (node: ts.Node) => {
    // Rule 1: the relational API, db.query.progress or db.query["progress"].
    if (ts.isPropertyAccessExpression(node) && TABLE_KEYS.includes(node.name.text) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "query") {
      add(node, `reaches ${node.name.text} through the relational API (db.query), which has no user filter`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "query" &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      TABLE_KEYS.includes(node.argumentExpression.text)
    ) {
      add(node, `reaches ${node.argumentExpression.text} through the relational API (db.query), which has no user filter`);
    }
    // Rule 1: table names handed to sql.identifier("progress") and the like.
    if (ts.isCallExpression(node) && callName(node) === "identifier" && node.arguments.some((a) => ts.isStringLiteralLike(a) && (TABLE_NAMES as readonly string[]).includes(a.text))) {
      add(node, "names a per-user table through sql.identifier(), which hides it from this check");
    }

    // Rule 2: where a table object may appear.
    if (ts.isIdentifier(node) && tables.has(node.text) && isReference(node) && !inType(node)) {
      const p = node.parent;
      const asTableArgument =
        ts.isCallExpression(p) && p.arguments[0] === node && p.arguments.length === 1 && ts.isPropertyAccessExpression(p.expression) && TABLE_METHODS.has(p.expression.name.text);
      const asColumnOwner = ts.isPropertyAccessExpression(p) && p.expression === node;
      if (!asTableArgument && !asColumnOwner) add(node, `uses the ${node.text} table outside .from(), .update(), .delete() or .insert()`);
      if (asTableArgument) checkChain(node, p as ts.CallExpression);
    }

    // Rule 4: SQL text (rule 6 in admin modules).
    const text = literalText(sf, node);
    if (text !== null && mentionsTable(text) && isAdmin) checkAdminSql(node, text);
    else if (text !== null && mentionsTable(text) && !reviewed.get(rel)?.includes(text)) {
      if (!isAllowed) add(node, "SQL that names a per-user table outside the allowed files");
      for (const problem of checkSqlText(text)) add(node, problem);
    }
    if (isAdmin && ts.isSourceFile(node.parent ?? node)) checkAdminExport(node);
    if (isAllowed && !seedFiles.has(rel) && ts.isCallExpression(node) && ["query", "execute"].includes(callName(node) ?? "")) checkSqlCall(node);

    // Rule 5: signatures.
    if (isAllowed && rel.endsWith(".ts")) checkSignature(node);
    ts.forEachChild(node, visit);
  };

  /** Rule 3, a Drizzle query chain that starts with `.from(t)`, `.update(t)`, `.delete(t)` or `.insert(t)`. */
  function checkChain(table: ts.Identifier, call: ts.CallExpression) {
    const method = (call.expression as ts.PropertyAccessExpression).name.text;
    const name = table.text;
    if (!hasUserIdParam(enclosingFunction(call))) add(call, `${method}(${name}) outside a function with a userId parameter`);
    const calls = chainCalls(chainTop(call));
    if (calls.some((c) => c.name === "$dynamic")) add(call, `${method}(${name}) uses $dynamic(), which hides conditions from this check`);
    if (method === "insert") {
      const values = calls.find((c) => c.name === "values");
      const keys = objectKeys(sf, values?.args[0]);
      const userIdKey = keys?.get("userId");
      const setsSessionUser =
        !!userIdKey &&
        (ts.isShorthandPropertyAssignment(userIdKey) || (ts.isPropertyAssignment(userIdKey) && ts.isIdentifier(userIdKey.initializer) && userIdKey.initializer.text === "userId"));
      if (!setsSessionUser || keys?.has("...")) add(call, `insert into ${name} without userId: userId in values()`);
      for (const c of calls.filter((x) => x.name === "onConflictDoUpdate")) {
        const options = objectKeys(sf, c.args[0]);
        const setProp = options?.get("set");
        const setKeys = setProp && ts.isPropertyAssignment(setProp) ? objectKeys(sf, setProp.initializer) : null;
        if (!setKeys || setKeys.has("userId") || setKeys.has("...")) add(call, `upsert on ${name} must set fields by name, never userId`);
        const target = options?.get("target");
        if (!target || !new RegExp(`\\b${name}\\.userId\\b`).test(target.getText(sf))) add(call, `upsert on ${name} without ${name}.userId in its target`);
      }
      return;
    }
    const wheres = calls.filter((c) => c.name === "where");
    if (wheres.length !== 1 || !wheres[0].args[0] || !isScopedCondition(sf, wheres[0].args[0], name)) {
      add(call, `${method}(${name}) needs one where() with eq(${name}.userId, userId) at its top level`);
    }
    if (method === "update") {
      const set = calls.find((c) => c.name === "set");
      const keys = objectKeys(sf, set?.args[0]);
      if (!keys || keys.has("userId") || keys.has("...")) add(call, `update(${name}) must set fields by name, never userId`);
    }
  }

  /** Rule 4, data layer: SQL naming a table is sent from a userId function, passing userId. */
  function checkSqlCall(call: ts.CallExpression) {
    const [first, params] = call.arguments;
    if (!first) return;
    const text = resolveSql(first);
    if (text === null || !mentionsTable(text)) return;
    if (!hasUserIdParam(enclosingFunction(call))) add(call, "SQL on a per-user table outside a function with a userId parameter");
    // A sql`` template carries its values inside; a query string takes a parameter array, and
    // every $n bound to user_id must be the userId parameter.
    const elements = params && ts.isArrayLiteralExpression(params) ? params.elements : null;
    const isUserId = (e: ts.Expression | undefined) => !!e && ts.isIdentifier(e) && e.text === "userId";
    const bindings = userIdBindings(text);
    const passesUserId =
      bindings.length > 0 &&
      bindings.every((b) => (b.startsWith("${") ? b === "${userId}" : !!elements && isUserId(elements[Number(b.slice(1)) - 1])));
    if (!passesUserId) add(call, "SQL on a per-user table that is not given userId");
  }

  /** The top-level function a node sits in (the outermost one), with its exported name if any. */
  function topLevelFunction(node: ts.Node): { name: string | null; exported: boolean } | null {
    let found: { name: string | null; exported: boolean } | null = null;
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
      if (ts.isFunctionDeclaration(current) && current.parent && ts.isSourceFile(current.parent)) {
        found = { name: current.name?.text ?? null, exported: !!ts.getModifiers(current)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
      }
      if (ts.isVariableStatement(current) && current.parent && ts.isSourceFile(current.parent)) {
        const decl = current.declarationList.declarations[0];
        found = { name: decl && ts.isIdentifier(decl.name) ? decl.name.text : null, exported: !!ts.getModifiers(current)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) };
      }
    }
    return found;
  }

  /** Rule 6: cross-user SQL only in reviewed, exported functions, and counts only. */
  function checkAdminSql(node: ts.Node, text: string) {
    const fn = topLevelFunction(node);
    if (!fn?.exported || !fn.name || !adminReviewed?.includes(fn.name)) {
      add(node, "cross-user SQL outside the reviewed admin functions");
    }
    if (/\b(note|link|token_hash)\b/i.test(text)) add(node, "admin SQL that names note, link or token_hash");
    if (/\b(user_settings|export_token)\b/i.test(text)) add(node, "admin SQL that names user_settings or export_token");
  }

  /** Rule 6: an exported function's first statement is the permission check. */
  function checkAdminExport(node: ts.Node) {
    const exported = ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) return;
    const fns: { name: string; fn: AnyFunction }[] = [];
    if (ts.isFunctionDeclaration(node) && node.name) fns.push({ name: node.name.text, fn: node });
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (d.initializer && ts.isIdentifier(d.name) && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) fns.push({ name: d.name.text, fn: d.initializer });
      }
    }
    for (const { name, fn } of fns) {
      const body = fn.body && ts.isBlock(fn.body) ? fn.body : null;
      const first = body?.statements[0];
      const call = (expr: ts.Expression | undefined) =>
        !!expr && ts.isAwaitExpression(expr) && ts.isCallExpression(expr.expression) && ts.isIdentifier(expr.expression.expression) && expr.expression.expression.text === "requirePermission";
      const checksFirst =
        !!first &&
        ((ts.isExpressionStatement(first) && call(first.expression)) ||
          (ts.isVariableStatement(first) && first.declarationList.declarations.length === 1 && call(first.declarationList.declarations[0].initializer)));
      if (!checksFirst) add(fn, `${name} must start with await requirePermission(…)`);
    }
  }

  function checkSignature(node: ts.Node) {
    const exported = (n: ts.Node) => ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const candidates: { name: string; fn: AnyFunction; at: ts.Node }[] = [];
    if (ts.isFunctionDeclaration(node) && node.name && exported(node)) candidates.push({ name: node.name.text, fn: node, at: node });
    if (ts.isVariableStatement(node) && exported(node)) {
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const found: AnyFunction[] = [];
        const collect = (n: ts.Node) => {
          if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) found.push(n);
          else if (ts.isCallExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) ts.forEachChild(n, collect);
        };
        collect(d.initializer);
        for (const fn of found) candidates.push({ name: d.name.text, fn, at: d });
      }
    }
    for (const { name, fn, at } of candidates) {
      if (PURE_EXPORTS.has(name)) continue;
      if (!fn.parameters.some((p) => p.type?.getText(sf) === "Db")) continue;
      const [first] = fn.parameters;
      if (!first || first.name.getText(sf) !== "userId" || first.type?.getText(sf) !== "string" || first.questionToken || first.initializer) {
        add(at, `${name} must take userId: string as its required first argument`);
      }
    }
  }

  visit(sf);
  return findings;
}
