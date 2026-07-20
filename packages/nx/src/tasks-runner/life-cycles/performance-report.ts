import type { Link, PerformanceSummaryPayload } from '../../native';
import { formatDuration } from '../../native';
import { supportsHyperlinks, terminalLink } from '../../utils/terminal-link';
import type {
  PerformanceSummary,
  TaskDurationRow,
} from './performance-analysis';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';
const NX_REMOTE_CACHE_URL = 'https://nx.dev/ci/features/remote-cache';
const NX_PERFORMANCE_URL =
  'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution';
/** utm tag attributing report clicks back to it; the content names the CTA clicked. */
const utm = (content: string) =>
  `?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=${content}`;
const NX_PERFORMANCE_LINK = `${NX_PERFORMANCE_URL}${utm('parallelization')}`;
const NX_AGENTS_LINK = `${NX_AGENTS_URL}${utm('nx-agents')}`;
const NX_REMOTE_CACHE_LINK = `${NX_REMOTE_CACHE_URL}${utm('remote-cache')}`;
/**
 * Whole-phrase CTA: the whole sentence is the link. The Rust TUI popup keeps no
 * copy of this string; it gets the phrase + href from the exit payload's `links`.
 */
const NX_REMOTE_CACHE_CTA =
  'Drastically reduce your run duration by sharing a cache across your team and CI';
const NX_DISTRIBUTE_CTA = 'Distribute across machines with Nx Agents';

/**
 * A recommendation built from structured parts so the link text comes from the link
 * definition (not a substring scanned out of the assembled report). A part is literal
 * text, a {@link RecLink}, or a {@link RecTaskRows}, projected to each output string by
 * {@link renderRecommendation}.
 *
 * String parts must be single-line — multi-line content needs its own structured part (as
 * {@link RecTaskRows} is). TS can't enforce this: `string` is already a handled member, so
 * a multi-line one compiles and then breaks the Markdown nested list.
 */
type RecPart = string | RecLink | RecTaskRows;
export type Recommendation = RecPart[];

/**
 * A docs link inside a recommendation: a sentence is the visible text and the whole of
 * it links to the utm-tagged URL. With OSC 8 the phrase is a hyperlink; without it the
 * tagged URL is appended as ` → <url>`. The payload string is URL-less — the Rust popup
 * re-links the phrase from {@link PerformanceSummaryPayload.links}.
 */
interface RecLink {
  visible: string;
  href: string;
}

/**
 * The critical path's longest tasks as data, so each renderer formats them natively:
 * the terminal and payload as space-aligned columns, Markdown as a nested list
 * (HTML collapses space runs, so aligned columns don't survive rendering there).
 */
type RecTaskRows = TaskDurationRow[];

function phraseLink(phrase: string, taggedUrl: string): RecLink {
  return { visible: phrase, href: taggedUrl };
}

// Discriminate positively — test for what each part *is*. A `!isRecTaskRows` catch-all
// would misclassify a future `RecPart` member as a link; TS can't catch that (it never
// checks a predicate body), so `recommendationLinks`' `.filter(isRecLink)` would ship
// `{text: undefined, href: undefined}` to the popup.
function isRecLink(part: RecPart): part is RecLink {
  return typeof part !== 'string' && 'href' in part;
}

function isRecTaskRows(part: RecPart): part is RecTaskRows {
  return Array.isArray(part);
}

/**
 * Project a recommendation to a string, formatting each non-text part with the caller's
 * renderers. The three output targets (payload, terminal, Markdown) share this one dispatch.
 * After the string and task-rows branches a part is a {@link RecLink}, so `render.link`
 * takes it directly — and a new {@link RecPart} member that is neither would fail to satisfy
 * that `RecLink` parameter, turning "forgot to handle it" into a compile error right here.
 */
function renderRecommendation(
  rec: Recommendation,
  render: {
    link: (link: RecLink) => string;
    taskRows: (rows: RecTaskRows) => string;
  }
): string {
  return rec
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (isRecTaskRows(part)) {
        return render.taskRows(part);
      }
      return render.link(part);
    })
    .join('');
}

/**
 * The recommendation string the napi payload ships and the Rust popup matches against.
 * Links are URL-less (the popup re-links them from {@link PerformanceSummaryPayload.links}).
 */
export function recommendationToPayloadString(rec: Recommendation): string {
  return renderRecommendation(rec, {
    link: (link) => link.visible,
    taskRows: taskRowsToText,
  });
}

/** Task rows as the text block the terminal and payload embed: newline-led, space-aligned columns. */
function taskRowsToText(tasks: RecTaskRows): string {
  return ['', ...formatTopTaskRows(tasks)].join('\n');
}

/**
 * The recommendation as a terminal string. With OSC 8 the phrase becomes a hyperlink
 * (the phrase visible, the tagged URL the target); without it the tagged URL is appended
 * as ` → <url>` — `terminalLink` can't do this since it drops the URL when hyperlinks
 * are off.
 */
function recommendationToTerminalString(
  rec: Recommendation,
  hyperlinks: boolean
): string {
  return renderRecommendation(rec, {
    link: (link) =>
      hyperlinks
        ? terminalLink(link.visible, link.href)
        : `${link.visible} → ${link.href}`,
    taskRows: taskRowsToText,
  });
}

/** The popup links (phrase + href) for every link in a recommendation list, for OSC 8 re-linking. */
function recommendationLinks(recommendations: Recommendation[]): Link[] {
  return recommendations.flatMap((rec) =>
    rec
      .filter(isRecLink)
      .map((part) => ({ text: part.visible, href: part.href }))
  );
}

/** Below this run duration (ms), the run is already fast — recommend nothing. */
export const MIN_RECOMMENDATION_RUN_DURATION = 30_000;
/** At/below this hit rate, recommend remote cache (if off); above it caching works. */
const LOW_CACHE_HIT_RATE = 0.1;
/** Below this (ms) overhead is noise, not worth a recommendation. */
export const MEANINGFUL_OVERHEAD = 1000;
/** Recommend --parallel when recoverable slot time is at least this fraction of the run. */
const PARALLEL_LEAD_FRACTION = 0.2;

/** Append "s" unless `count` is 1 (regular plurals only). */
function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/** Slot-contention time recoverable by parallelism or more machines (the "recoverable" number both the report and TUI payload show). Derived, never stored, so the halves can't drift from their sum. */
function recoverableTime(s: PerformanceSummary): number {
  return s.recoverableByParallel + s.recoverableByMachines;
}

/** Render the longest critical-path tasks as aligned columns: task (left), duration (right). */
function formatTopTaskRows(tasks: TaskDurationRow[]): string[] {
  // Non-empty by construction: the only recommendation carrying task rows requires
  // `criticalPathTop.length > 0` to apply, so no empty array reaches the widths below.
  const idWidth = Math.max(...tasks.map((t) => t.id.length));
  const durations = tasks.map((t) => formatDuration(t.duration));
  const durWidth = Math.max(...durations.map((d) => d.length));
  return tasks.map((t, i) => {
    const id = t.id.padEnd(idWidth);
    const dur = durations[i].padStart(durWidth);
    return `  ${id}    ${dur}`;
  });
}

/** Everything a recommendation candidate inspects to decide whether it applies and to build itself. */
interface RecommendationContext {
  recoverableByParallel: number;
  recoverableByMachines: number;
  /** Slot time recoverable by parallelism or more machines (the two halves' sum). */
  recoverable: number;
  coordinatorDominated: boolean;
  runDuration: number;
  canDistribute: boolean;
  distributing: boolean;
  criticalPathTop: TaskDurationRow[];
  cacheHits: number;
  cacheableCount: number;
  cacheSkipped: boolean;
  remoteCacheEnabled: boolean;
  /** Opted out of Nx Cloud (`neverConnectToCloud` / NX_NO_CLOUD) — never recommend it. */
  cloudOptedOut: boolean;
}

/** A single recommendation: the criteria under which it applies and the advice it yields. */
interface RecommendationCandidate {
  isApplicable(c: RecommendationContext): boolean;
  build(c: RecommendationContext): Recommendation;
}

// Bottleneck predicates, shared so the speed levers below stay mutually exclusive: a run
// gets one parallelism lever, never both "raise --parallel" and "distribute". Each names
// the run shape it diagnoses.

/** Spare cores: raising local --parallel recovers a meaningful slice and is the dominant half. */
const parallelLeverApplies = (c: RecommendationContext): boolean =>
  !c.distributing &&
  c.runDuration > 0 &&
  c.recoverableByParallel >= PARALLEL_LEAD_FRACTION * c.runDuration &&
  c.recoverableByParallel >= c.recoverableByMachines;

/** Already on agents: more agents recovers a meaningful slice. */
const agentsLeverApplies = (c: RecommendationContext): boolean =>
  c.distributing &&
  c.runDuration > 0 &&
  c.recoverable >= PARALLEL_LEAD_FRACTION * c.runDuration;

/**
 * Machine-bound: slots a higher local --parallel can't free (the core ceiling, or a
 * parallelism:false task / volume monopolizing the pool) — only more machines free them.
 */
const machineBound = (c: RecommendationContext): boolean =>
  !c.distributing && c.recoverableByMachines >= MEANINGFUL_OVERHEAD;

/** Coordinator-dominated and not machine-bound: the machine is ~maxed on overhead. */
const coordinatorBound = (c: RecommendationContext): boolean =>
  !c.distributing &&
  c.recoverableByMachines < MEANINGFUL_OVERHEAD &&
  c.coordinatorDominated;

/** No parallelism/machine/coordinator lever is the bottleneck → the critical path is. */
const criticalPathBound = (c: RecommendationContext): boolean =>
  !parallelLeverApplies(c) &&
  !agentsLeverApplies(c) &&
  !machineBound(c) &&
  !coordinatorBound(c);

/**
 * Every recommendation the report can make, in display order — cheapest lever first, the
 * deep "speed up the longest tasks" work last. The report shows exactly the applicable
 * ones: `RECOMMENDATIONS.filter((r) => r.isApplicable(c))`. Each carries its own criteria;
 * the bottleneck predicates above keep the speed levers mutually exclusive.
 */
const RECOMMENDATIONS: RecommendationCandidate[] = [
  {
    // Spare cores: the lever is local --parallel. Whole-phrase link to the perf docs; the
    // period stays outside the link.
    isApplicable: parallelLeverApplies,
    build: (c) => [
      phraseLink(
        `Increase parallelism to recover up to ${formatDuration(
          c.recoverableByParallel
        )}`,
        NX_PERFORMANCE_LINK
      ),
      `.`,
    ],
  },
  {
    // Already on agents: more agents (not local --parallel) is the parallelism lever.
    isApplicable: agentsLeverApplies,
    build: (c) => [
      `Add more Nx Agents to recover up to ${formatDuration(c.recoverable)}.`,
    ],
  },
  {
    // Barely-used cache with no remote: set up Nx Cloud. Whole-phrase link; the payload
    // string stays URL-less (the popup re-links the phrase). Never pushed at a
    // workspace that opted out of Nx Cloud.
    isApplicable: (c) =>
      !c.cacheSkipped &&
      !c.cloudOptedOut &&
      c.cacheableCount > 0 &&
      !c.remoteCacheEnabled &&
      c.cacheHits / c.cacheableCount <= LOW_CACHE_HIT_RATE,
    build: () => [phraseLink(NX_REMOTE_CACHE_CTA, NX_REMOTE_CACHE_LINK), `.`],
  },
  {
    // Cache skipped: drop the flag to restore unchanged tasks instantly.
    isApplicable: (c) => c.cacheSkipped,
    build: () => [
      `Cache: drop --skip-nx-cache to restore unchanged tasks instantly.`,
    ],
  },
  {
    // Machine-bound, coordinator-dominated, or a recoverable critical-path-bound run: more
    // machines help, and that lever only exists in CI (canDistribute). Excludes the
    // --parallel case so the two parallelism levers never show together.
    isApplicable: (c) =>
      c.canDistribute &&
      !parallelLeverApplies(c) &&
      (machineBound(c) ||
        coordinatorBound(c) ||
        (criticalPathBound(c) &&
          c.runDuration > 0 &&
          c.recoverable >= PARALLEL_LEAD_FRACTION * c.runDuration)),
    build: () => [phraseLink(NX_DISTRIBUTE_CTA, NX_AGENTS_LINK), `.`],
  },
  {
    // Critical-path-bound: shorten the chain's longest tasks (the deepest manual work, the
    // only multi-line rec). Nothing ran (fully cached) → it doesn't apply.
    isApplicable: (c) => criticalPathBound(c) && c.criticalPathTop.length > 0,
    build: (c) => [
      `Speed up or split the longest tasks on the critical path:`,
      c.criticalPathTop,
    ],
  },
];

/**
 * The recommendations the report shows, in display order: every candidate in
 * {@link RECOMMENDATIONS} whose criteria apply to this run. Shared by the terminal report,
 * the GitHub-summary Markdown, and the TUI payload.
 */
export function buildRecommendations(s: PerformanceSummary): Recommendation[] {
  // A fast run has nothing worth optimizing — stats only, no advice.
  if (s.runDuration < MIN_RECOMMENDATION_RUN_DURATION) {
    return [];
  }
  const c: RecommendationContext = {
    recoverableByParallel: s.recoverableByParallel,
    recoverableByMachines: s.recoverableByMachines,
    recoverable: recoverableTime(s),
    coordinatorDominated: s.coordinatorDominated,
    runDuration: s.runDuration,
    canDistribute: s.canDistribute,
    distributing: s.distributing,
    criticalPathTop: s.criticalPathTop,
    cacheHits: s.cacheHits,
    cacheableCount: s.cacheableCount,
    cacheSkipped: s.cacheSkipped,
    remoteCacheEnabled: s.remoteCacheEnabled,
    cloudOptedOut: s.cloudOptedOut,
  };
  return RECOMMENDATIONS.filter((r) => r.isApplicable(c)).map((r) =>
    r.build(c)
  );
}

/** Top-of-report cache stat: hit rate or skip marker. Null when there's no cache outcome. */
function cacheStat(s: PerformanceSummary): string | null {
  if (s.cacheSkipped) {
    return 'Skipped (--skip-nx-cache)';
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  const pct = Math.round((s.cacheHits / s.cacheableCount) * 100);
  return `${s.cacheHits}/${s.cacheableCount} hit (${pct}%)`;
}

/** The full performance report as a terminal string (the TUI popup renders natively from {@link buildExitSummaryPayload} instead). */
export function formatReport(s: PerformanceSummary): string {
  const fmt = formatDuration;
  // Shows two of run duration's three parts (critical path + recoverable); the third,
  // coordinator overhead, isn't displayed, so the two don't sum to run duration.
  const recoverable = recoverableTime(s);
  const recoverablePct =
    s.runDuration > 0 ? Math.round((recoverable / s.runDuration) * 100) : 0;
  // Pad to the widest label ("Recoverable time:" = 17) so values align without a
  // gaping gap. Keep in sync with the Rust popup's stat_line.
  const stat = (label: string, value: string) =>
    `  ${`${label}:`.padEnd(17)}  ${value}`;
  // No leading blank line: nx's run summary already prints trailing blanks before this.
  const cache = cacheStat(s);
  const lines = [
    stat('Run duration', fmt(s.runDuration)),
    ...(cache ? [stat('Cache', cache)] : []),
    stat(
      'Critical path',
      `${fmt(s.criticalPathDuration)} (${
        s.criticalPathTaskCount
      } ${pluralize(s.criticalPathTaskCount, 'task')})`
    ),
    stat(
      'Recoverable time',
      recoverable > 0
        ? `${fmt(recoverable)} (${recoverablePct}% of the run)`
        : fmt(recoverable)
    ),
  ];
  const hyperlinks = supportsHyperlinks();
  const recommendations = buildRecommendations(s);
  const render = (r: Recommendation) =>
    recommendationToTerminalString(r, hyperlinks);
  // A rec may be multi-line (the critical-path one embeds a task list); indent
  // continuation lines under the bullet.
  const renderRec = (r: string): string[] => {
    const [first, ...rest] = r.split('\n');
    return [`    - ${first}`, ...rest.map((l) => `      ${l}`)];
  };
  if (recommendations.length > 0) {
    const onlySingleLine =
      recommendations.length === 1 &&
      !recommendationToPayloadString(recommendations[0]).includes('\n');
    if (onlySingleLine) {
      lines.push('', `  Recommendation: ${render(recommendations[0])}`);
    } else {
      lines.push(
        '',
        '  Recommendations:',
        ...recommendations.flatMap((r) => renderRec(render(r)))
      );
    }
  }
  // No trailing newline — the caller's console.log adds the line terminator.
  return lines.join('\n');
}

/**
 * A recommendation as Markdown: every link becomes `[phrase](href)` (no OSC 8, unlike the
 * terminal renderer) — the whole sentence reads as prose and is the link text. Task rows
 * become a nested list under the recommendation's bullet (space-aligned columns don't
 * survive HTML's whitespace collapsing).
 */
function recommendationToMarkdownString(rec: Recommendation): string {
  return renderRecommendation(rec, {
    link: (link) => `[${link.visible}](${link.href})`,
    taskRows: (rows) =>
      rows
        .map((t) => `\n  - \`${t.id}\` — ${formatDuration(t.duration)}`)
        .join(''),
  });
}

/**
 * The performance report as GitHub-flavored Markdown for the Actions job summary
 * (`$GITHUB_STEP_SUMMARY`). Mirrors {@link formatReport}'s content — the same stats and
 * recommendations — and, when the run had failures, lists them above the stats. Links
 * render as Markdown links rather than OSC 8 hyperlinks.
 *
 * `command` (the nx command, e.g. `run-many -t build`) is appended to the heading so
 * stacked reports from multiple nx commands in one job summary stay distinguishable.
 */
export function formatReportMarkdown(
  s: PerformanceSummary,
  command: string
): string {
  const fmt = formatDuration;
  const recoverable = recoverableTime(s);
  const recoverablePct =
    s.runDuration > 0 ? Math.round((recoverable / s.runDuration) * 100) : 0;
  const cache = cacheStat(s);

  const lines = [`## Nx Run Report — \`${command}\``];

  // The run's outcome is the headline of a CI summary, so it goes first — above the
  // performance stats. Failures list the slowest tasks; a green run states it succeeded.
  const failedTasks = s.failedTasks;
  if (failedTasks.length > 0) {
    lines.push(
      '',
      `### ❌ ${failedTasks.length} failed ${pluralize(
        failedTasks.length,
        'task'
      )}`,
      '',
      ...failedTasks.map((id) => `- \`${id}\``)
    );
  } else {
    lines.push('', '### ✅ All tasks succeeded');
  }

  // Headline stats as a bold-label list, mirroring the terminal stat lines.
  lines.push(
    '',
    '### Performance',
    '',
    `- **Run duration:** ${fmt(s.runDuration)}`,
    ...(cache ? [`- **Cache:** ${cache}`] : []),
    `- **Critical path:** ${fmt(s.criticalPathDuration)} (${
      s.criticalPathTaskCount
    } ${pluralize(s.criticalPathTaskCount, 'task')})`,
    `- **Recoverable time:** ${
      recoverable > 0
        ? `${fmt(recoverable)} (${recoverablePct}% of the run)`
        : fmt(recoverable)
    }`
  );

  const recommendations = buildRecommendations(s);
  if (recommendations.length > 0) {
    lines.push('', '### Recommendations', '');
    for (const rec of recommendations) {
      lines.push(`- ${recommendationToMarkdownString(rec)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build the payload for the TUI's exit-countdown popup, which renders natively in Rust
 * (the terminal path uses {@link formatReport}). The shape is the generated napi
 * {@link PerformanceSummaryPayload}, imported not re-declared so the producer and the
 * Rust struct can't drift.
 */
export function buildExitSummaryPayload(
  s: PerformanceSummary
): PerformanceSummaryPayload {
  const hasCache = s.cacheableCount > 0;
  const recommendations = buildRecommendations(s);
  return {
    runDurationMs: s.runDuration,
    criticalPathMs: s.criticalPathDuration,
    criticalPathTaskCount: s.criticalPathTaskCount,
    recoverableMs: recoverableTime(s),
    // One nested field, not a hits/total pair: "one set, the other not" is
    // unrepresentable, so the Rust side drops its defensive match.
    cache: hasCache
      ? { hits: s.cacheHits, total: s.cacheableCount }
      : undefined,
    cacheSkipped: s.cacheSkipped,
    // The napi payload ships plain strings; a phrase link (the remote-cache CTA)
    // stays URL-less here and is re-linked from `links` by the popup.
    recommendations: recommendations.map(recommendationToPayloadString),
    // Phrase links (e.g. the remote-cache CTA) carry their href as data so the
    // popup hyperlinks the phrase in place; surfaced only when shown.
    links: recommendationLinks(recommendations),
  };
}
