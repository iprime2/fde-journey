// Static check that every query on the per-user tables is scoped to a user. Used by
// tests/unit/isolation-guard.test.ts on the app's own files, and on small bad examples to prove it
// catches them. It reads the code with the TypeScript parser; nothing is run.
//
// Rules:
// 1. Only allow-listed files may use the Drizzle table objects (`progress`, `progressEvent`) or
//    write SQL that names the tables. Everything else must go through lib/progress-db.ts.
// 2. Drizzle queries: every `.select().from(t)`, `.update(t)` and `.delete(t)` chain has a
//    `.where(...)` that mentions `t.userId`; every `.insert(t).values(...)` sets `userId`.
// 3. SQL text: every `from`, `update`, `delete from` and `join` of a table is followed by a
//    `user_id =` condition before the next table reference; every `insert into t (...)` lists
//    `user_id`; every `on conflict (...)` names `user_id`.
// 4. In the allowed TypeScript files, exported functions that take a database (`Db`) take
//    `userId: string` as their required first argument, except pure helpers in PURE_EXPORTS.
import ts from "typescript";

export const TABLE_OBJECTS = ["progress", "progressEvent"] as const;
export const TABLE_NAMES = ["progress", "progress_event"] as const;

export interface GuardOptions {
  /** Files (relative paths) allowed to touch the tables at all. */
  allowed: ReadonlySet<string>;
}

export interface Finding {
  file: string;
  line: number;
  problem: string;
}

/** `from progress`, `into "progress_event"`, … but not `"progress"."user_id"` or `progress_events`. */
const TABLE_REF_SOURCE = String.raw`\b(from|into|update|join)\s+(?:"public"\.)?"?(progress_event|progress)"?(?![\w."])`;
/** A fresh regex each time: a shared global one carries `lastIndex` between calls. */
const tableRefs = () => new RegExp(TABLE_REF_SOURCE, "gi");

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
    } else if (!/\b"?user_id"?\s*=/.test(rest)) {
      problems.push(`${keyword} ${table} without a user_id = condition`);
    }
  });
  for (const m of text.matchAll(/\bon\s+conflict\s*\(([^)]*)\)/gi)) {
    if (!/user_id/.test(m[1])) problems.push("on conflict without user_id in its target");
  }
  return problems;
}

const mentionsTable = (text: string) => tableRefs().test(text) || /\bon\s+conflict\b/i.test(text);

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
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        calls.push({ name: node.expression.name.text, args: node.arguments });
        node = node.expression.expression;
        continue;
      }
      break;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isNonNullExpression(node)) {
      node = node.expression;
      continue;
    }
    break;
  }
  return calls;
}

const PURE_EXPORTS = new Set(["toEntry"]);

/** Checks one file. `rel` is its path relative to web/. */
export function checkSource(rel: string, source: string, { allowed }: GuardOptions): Finding[] {
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, scriptKind(rel));
  const findings: Finding[] = [];
  const add = (node: ts.Node, problem: string) => findings.push({ file: rel, line: lineOf(sf, node), problem });
  const isAllowed = allowed.has(rel);

  const visit = (node: ts.Node) => {
    // Rule 1, Drizzle: the table objects, imported from the schema.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /(^@\/db\/schema$|\/db\/schema(\.ts)?$)/.test(node.moduleSpecifier.text)) {
      const names = node.importClause?.namedBindings;
      if (names && ts.isNamedImports(names)) {
        for (const el of names.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if ((TABLE_OBJECTS as readonly string[]).includes(imported)) {
            if (!isAllowed) add(el, `imports the ${imported} table: only ${[...allowed].join(", ")} may query it`);
            if (el.propertyName) add(el, `renames the ${imported} table on import, which hides it from this check`);
          }
        }
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /db\/schema/.test(node.moduleSpecifier.text)) {
      if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
        add(node, "imports the schema as a namespace, which hides table use from this check");
      }
    }

    // Rule 2, Drizzle query chains.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const [arg] = node.arguments;
      const table = arg && ts.isIdentifier(arg) && (TABLE_OBJECTS as readonly string[]).includes(arg.text) ? arg.text : null;
      if (table && ["from", "update", "delete", "insert"].includes(method)) {
        const calls = chainCalls(chainTop(node));
        if (method === "insert") {
          const values = calls.find((c) => c.name === "values");
          if (!values || !values.args.some((a) => /\buserId\b/.test(a.getText(sf)))) add(node, `insert into ${table} without userId in values()`);
        } else {
          const where = calls.find((c) => c.name === "where");
          const scoped = where?.args.some((a) => new RegExp(`\\b${table}\\.userId\\b`).test(a.getText(sf)));
          if (!scoped) add(node, `${method}(${table}) without a where() on ${table}.userId`);
        }
      }
    }

    // Rule 1 and 3, SQL text.
    const text = literalText(sf, node);
    if (text !== null && mentionsTable(text)) {
      if (!isAllowed) add(node, "SQL that names a per-user table outside the allowed files");
      for (const problem of checkSqlText(text)) add(node, problem);
    }

    // Rule 4, the signature (data-layer files only).
    if (
      isAllowed &&
      rel.endsWith(".ts") &&
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      !PURE_EXPORTS.has(node.name.text) &&
      node.parameters.some((p) => p.type?.getText(sf) === "Db")
    ) {
      const [first] = node.parameters;
      if (!first || first.name.getText(sf) !== "userId" || first.type?.getText(sf) !== "string" || first.questionToken || first.initializer) {
        add(node, `${node.name.text} must take userId: string as its required first argument`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}
