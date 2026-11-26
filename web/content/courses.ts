// Courses & badges: vendor courses from OpenAI and Anthropic, each placed in the roadmap phase
// where it fits. Copied from the approved content plan, web/docs/COURSES.md (2026-11-26); a unit
// test checks this list against the plan's table. This content lives only in the app (the old
// tracker artifact never had it).
//
// Ids are `cr{n}` from the position in COURSES (lib/ids.ts, courseId). Append only: never reorder
// or delete, or saved progress would move to another course.
import type { Course, CourseProvider } from "./types";

export const COURSES: readonly Course[] = [
  // cr1
  {
    provider: "OpenAI",
    title: "AI app development: concept to production",
    url: "https://developers.openai.com/tracks/ai-application-development",
    length: "2–4 h",
    level: "Intermediate",
    badge: false,
    phase: 1,
  },
  // cr2
  {
    provider: "OpenAI",
    title: "Building agents",
    url: "https://developers.openai.com/tracks/building-agents",
    length: "1–3 h",
    level: "Beginner",
    badge: false,
    phase: 4,
  },
  // cr3
  {
    provider: "OpenAI",
    title: "Model optimization",
    url: "https://developers.openai.com/tracks/model-optimization",
    length: "1–2 h",
    level: "Advanced",
    badge: false,
    phase: 7,
  },
  // cr4
  {
    provider: "OpenAI Academy",
    title: "Scope AI Solutions",
    url: "https://academy.openai.com/public/courses/scope-ai-solutions-kjplw",
    length: "",
    badge: true,
    phase: 8,
    topPick: "scoping a customer problem into a solution plan",
  },
  // cr5
  {
    provider: "OpenAI Academy",
    title: "Evaluate AI Applications",
    url: "https://academy.openai.com/public/courses/evaluate-ai-applications-pxds7",
    length: "",
    badge: true,
    phase: 7,
    topPick: "evals",
  },
  // cr6
  {
    provider: "OpenAI Academy",
    title: "Design and Build Agentic Systems",
    url: "https://academy.openai.com/public/courses/design-and-build-agentic-systems-k5uke",
    length: "",
    badge: true,
    phase: 4,
  },
  // cr7
  {
    provider: "OpenAI Academy",
    title: "Build with Retrieval-Augmented Generation",
    url: "https://academy.openai.com/public/courses/build-with-retrieval-augmented-generation-2v6xg",
    length: "",
    badge: true,
    phase: 2,
  },
  // cr8
  {
    provider: "OpenAI Academy",
    title: "Optimize AI Application Performance",
    url: "https://academy.openai.com/public/courses/optimize-ai-application-performance-1k50h",
    length: "",
    badge: true,
    phase: 7,
  },
  // cr9
  {
    provider: "OpenAI Academy",
    title: "Get Started with Codex",
    url: "https://academy.openai.com/public/courses/get-started-with-codex-jkhsq",
    length: "",
    badge: true,
    phase: 4,
  },
  // cr10
  {
    provider: "OpenAI Academy",
    title: "Extend Codex Workflows",
    url: "https://academy.openai.com/public/courses/extend-codex-workflows-4e61p",
    length: "",
    badge: true,
    phase: 5,
  },
  // cr11
  {
    provider: "OpenAI Academy",
    title: "Scale Codex Across Governed Teams and Systems",
    url: "https://academy.openai.com/public/courses/scale-codex-across-teams-and-systems-jr83a",
    length: "",
    badge: true,
    phase: 5,
  },
  // cr12
  {
    provider: "Anthropic",
    title: "Building with the Claude API",
    url: "https://academy.claude.com/courses/building-with-the-claude-api",
    length: "67 lessons · 9 h",
    badge: true,
    phase: 1,
  },
  // cr13
  {
    provider: "Anthropic",
    title: "Claude Platform 101",
    url: "https://academy.claude.com/courses/claude-platform-101",
    length: "13 lessons · 1.5 h",
    badge: true,
    phase: 1,
  },
  // cr14
  {
    provider: "Anthropic",
    title: "AI Fluency: Framework and foundations",
    url: "https://academy.claude.com/courses/ai-fluency-framework-foundations",
    length: "14 lessons · 4 h",
    badge: true,
    phase: 1,
  },
  // cr15
  {
    provider: "Anthropic",
    title: "AI capabilities and limitations",
    url: "https://academy.claude.com/courses/ai-capabilities-and-limitations",
    length: "13 lessons · 3.5 h",
    badge: true,
    phase: 1,
  },
  // cr16
  {
    provider: "Anthropic",
    title: "Claude Code 101",
    url: "https://academy.claude.com/courses/claude-code-101",
    length: "12 lessons · 1.5 h",
    badge: true,
    phase: 1,
  },
  // cr17
  {
    provider: "Anthropic",
    title: "Tool use with the Messages API",
    url: "https://academy.claude.com/courses/tool-use-with-the-messages-api",
    length: "9 lessons · 1.5 h",
    badge: true,
    phase: 4,
  },
  // cr18
  {
    provider: "Anthropic",
    title: "Introduction to Model Context Protocol",
    url: "https://academy.claude.com/courses/introduction-to-model-context-protocol",
    length: "10 lessons · 1 h",
    badge: true,
    phase: 4,
  },
  // cr19
  {
    provider: "Anthropic",
    title: "Model Context Protocol: Advanced topics",
    url: "https://academy.claude.com/courses/model-context-protocol-advanced-topics",
    length: "11 lessons · 1.5 h",
    badge: true,
    phase: 4,
  },
  // cr20
  {
    provider: "Anthropic",
    title: "Claude Code in action",
    url: "https://academy.claude.com/courses/claude-code-in-action",
    length: "9 lessons · 1 h",
    badge: true,
    phase: 4,
  },
  // cr21
  {
    provider: "Anthropic",
    title: "Introduction to agent skills",
    url: "https://academy.claude.com/courses/introduction-to-agent-skills",
    length: "6 lessons · 1 h",
    badge: false,
    phase: 4,
  },
  // cr22
  {
    provider: "Anthropic",
    title: "Introduction to subagents",
    url: "https://academy.claude.com/courses/introduction-to-subagents",
    length: "4 lessons · 45 min",
    badge: false,
    phase: 4,
  },
  // cr23
  {
    provider: "Anthropic",
    title: "Building effective human-agent teams (beta)",
    url: "https://academy.claude.com/courses/building-effective-human-agent-teams",
    length: "5 lessons · 45 min",
    badge: true,
    phase: 5,
  },
  // cr24
  {
    provider: "Anthropic",
    title: "The AI-native SDLC playbook",
    url: "https://academy.claude.com/courses/ai-native-sdlc-playbook",
    length: "14 lessons · 1.5 h",
    badge: false,
    phase: 5,
  },
  // cr25
  {
    provider: "Anthropic",
    title: "Claude with Amazon Bedrock",
    url: "https://academy.claude.com/courses/claude-with-amazon-bedrock",
    length: "65 lessons · 8 h",
    badge: true,
    phase: 6,
    topPick: "lines up with the AWS certifications",
  },
  // cr26
  {
    provider: "Anthropic",
    title: "Introduction to evals",
    url: "https://academy.claude.com/courses/introduction-to-evals",
    length: "4 lessons · 1 h",
    badge: true,
    phase: 7,
    topPick: "evals",
  },
  // cr27
  {
    provider: "Anthropic",
    title: "Deploying Claude Enterprise with confidence",
    url: "https://academy.claude.com/courses/deploying-claude-enterprise-with-confidence",
    length: "14 lessons · 2.5 h",
    badge: true,
    phase: 8,
    topPick: "rolling out at a customer",
  },
];

/**
 * Phase names as the plan's table gives them. Some are shorter than the roadmap's titles ("Project
 * 2" for "Project 2 — AI SRE Agent"), which keeps the phase chip on one line on a phone.
 */
export const COURSE_PHASE_NAMES: Readonly<Record<number, string>> = {
  1: "Foundations",
  2: "RAG and retrieval",
  4: "Agents and harnesses",
  5: "Project 2",
  6: "AWS cloud and deployment",
  7: "Evaluation",
  8: "Portfolio and career",
};

/** The page's cards, one per provider, in this order. */
export interface CourseGroup {
  provider: CourseProvider;
  /** Filter section key. */
  key: string;
  title: string;
  sub: string;
}

export const COURSE_GROUPS: readonly CourseGroup[] = [
  {
    provider: "OpenAI",
    key: "openai",
    title: "OpenAI developer tracks",
    sub: "Self-paced tracks on OpenAI's developer site. Each gives a length and a level; no badge is mentioned.",
  },
  {
    provider: "OpenAI Academy",
    key: "openai-academy",
    title: "OpenAI Academy · Build with AI",
    sub: "Every course ends with an assessment and an official badge, issued through Accredible.",
  },
  {
    provider: "Anthropic",
    key: "anthropic",
    title: "Anthropic Claude Academy",
    sub: "A completion badge where the course page lists one.",
  },
];

/** Where the lengths and badges come from (the plan's sources, read on COURSES_CHECKED). */
export const COURSE_SOURCES = [
  {
    label: "OpenAI developer tracks",
    url: "https://developers.openai.com/learn",
    note: "The learn page and its three track pages: length and level are given; no badge is mentioned.",
  },
  {
    label: "OpenAI Academy courses",
    url: "https://academy.openai.com/pages/courses",
    note: "“Every course includes an assessment, with official badges issued through Accredible.”",
  },
  {
    label: "Claude Academy courses",
    url: "https://academy.claude.com/courses",
    note: "“Completion badge” is listed per course where it applies.",
  },
] as const;

/** ISO date the providers' pages were read. */
export const COURSES_CHECKED = "2026-11-26";

/** Small print under the list: recheck before relying on the lengths and badges. */
export const COURSES_DISCLAIMER =
  "Lengths and badges from the providers' pages, checked 26 Nov 2026. Providers change their catalogues, so check before relying on them.";
