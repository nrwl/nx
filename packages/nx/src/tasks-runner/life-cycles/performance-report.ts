import type { Link, PerformanceSummaryPayload } from '../../native';
import { formatDuration } from '../../native';
import { supportsHyperlinks, terminalLink } from '../../utils/terminal-link';
import type { PerformanceSummary } from './performance-analysis';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';
const NX_REMOTE_CACHE_URL = 'https://nx.dev/ci/features/remote-cache';
const NX_PERFORMANCE_URL =
  'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution';
/** utm tag attributing report clicks back to it. */
const UTM = '?utm=performance-report';
const NX_PERFORMANCE_LINK = `${NX_PERFORMANCE_URL}${UTM}`;
const NX_AGENTS_LINK = `${NX_AGENTS_URL}${UTM}`;
const NX_REMOTE_CACHE_LINK = `${NX_REMOTE_CACHE_URL}${UTM}`;
const NX_PERFORMANCE_LABEL = `Learn how to improve your run's performance`;
/**
 * Whole-phrase CTA: the whole sentence is the link. The Rust TUI popup keeps no
 * copy of this string; it gets the phrase + href from the exit payload's `links`.
 */
const NX_REMOTE_CACHE_CTA =
  'Drastically reduce your run duration by sharing a cache across your team and CI';

/**
 * A recommendation built from structured parts so the link text comes from the
 * link definition (not a substring scanned out of the assembled report). A part
 * is either literal text or a {@link RecLink}; the renderers below project the
 * same parts to the terminal string, the payload string, and the popup links.
 */
type RecPart = string | RecLink;
export type Recommendation = RecPart[];

/**
 * A docs link inside a recommendation, in one of two styles:
 *
 * - `url`   — the URL itself is the visible text. The clean URL shows (and is the
 *   OSC 8 label), the utm-tagged URL is the click target. Without OSC 8 the tagged
 *   URL prints verbatim (e.g. the agents recs, the footer).
 * - `phrase` — a sentence is the visible text and the whole of it links to the
 *   tagged URL. Without OSC 8 the tagged URL is appended as ` → <url>` (the
 *   remote-cache CTA). The payload string for a phrase link is URL-less: the Rust
 *   popup re-links the phrase from {@link PerformanceSummaryPayload.links}.
 */
interface RecLink {
  /** Visible label: the clean URL (`url`) or the sentence (`phrase`). */
  visible: string;
  /** OSC 8 click target / appended URL: always the utm-tagged URL. */
  href: string;
  style: 'url' | 'phrase';
}

function urlLink(cleanUrl: string, taggedUrl: string): RecLink {
  return { visible: cleanUrl, href: taggedUrl, style: 'url' };
}

function phraseLink(phrase: string, taggedUrl: string): RecLink {
  return { visible: phrase, href: taggedUrl, style: 'phrase' };
}

function isRecLink(part: RecPart): part is RecLink {
  return typeof part !== 'string';
}

/**
 * The recommendation string the napi payload ships and the Rust popup matches
 * against. A `url` link keeps its tagged URL inline; a `phrase` link is URL-less
 * (the popup re-links it from {@link PerformanceSummaryPayload.links}).
 */
export function recommendationToPayloadString(rec: Recommendation): string {
  return rec
    .map((part) =>
      !isRecLink(part) ? part : part.style === 'url' ? part.href : part.visible
    )
    .join('');
}

/**
 * The recommendation as a terminal string. With OSC 8 each link becomes a
 * hyperlink (clean URL or whole phrase as the visible label, tagged URL the
 * target). Without it, a `url` link prints its tagged URL and a `phrase` link
 * gets ` → <tagged url>` appended — `terminalLink` can't do this since it drops
 * the URL entirely when hyperlinks are off.
 */
function recommendationToTerminalString(
  rec: Recommendation,
  hyperlinks: boolean
): string {
  return rec
    .map((part) => {
      if (!isRecLink(part)) {
        return part;
      }
      if (hyperlinks) {
        return terminalLink(part.visible, part.href);
      }
      return part.style === 'url'
        ? part.href
        : `${part.visible} → ${part.href}`;
    })
    .join('');
}

/** True when a shown rec already links to the perf docs, making the generic footer (which points at the same page) redundant. */
function linksToPerformanceDocs(recommendations: Recommendation[]): boolean {
  return recommendations.some((rec) =>
    rec.some((part) => isRecLink(part) && part.href === NX_PERFORMANCE_LINK)
  );
}

/** The footer candidate's criteria: show the generic "learn more" footer only when no recommendation already links to that same page. Shared by every renderer (terminal, TUI, GitHub summary) so the footer stays aligned across them. */
function shouldShowFooter(recommendations: Recommendation[]): boolean {
  return !linksToPerformanceDocs(recommendations);
}

/** The popup links for the phrase-style CTAs in a recommendation list (url links live inline in the strings). */
function recommendationLinks(recommendations: Recommendation[]): Link[] {
  return recommendations.flatMap((rec) =>
    rec
      .filter(isRecLink)
      .filter((part) => part.style === 'phrase')
      .map((part) => ({ text: part.visible, href: part.href }))
  );
}

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
function formatTopTaskRows(
  tasks: Array<{ id: string; duration: number }>
): string[] {
  // The only caller returns early when empty, so `tasks` is non-empty here.
  const idWidth = Math.max(...tasks.map((t) => t.id.length));
  const durations = tasks.map((t) => formatDuration(t.duration));
  const durWidth = Math.max(...durations.map((d) => d.length));
  return tasks.map((t, i) => {
    const id = t.id.padEnd(idWidth);
    const dur = durations[i].padStart(durWidth);
    return `  ${id}    ${dur}`;
  });
}

/** An Nx Agents URL link, built from the link definition so the URL text never has to be scanned back out of the assembled report. */
const agentsLink: RecLink = urlLink(NX_AGENTS_URL, NX_AGENTS_LINK);

/** Everything a lever candidate inspects to decide whether it applies and to build itself. */
interface RecommendationContext {
  recoverableByParallel: number;
  recoverableByMachines: number;
  /** Slot time recoverable by parallelism or more machines (the two halves' sum). */
  recoverable: number;
  coordinatorDominated: boolean;
  runDuration: number;
  parallel: number;
  cores: number;
  canDistribute: boolean;
  distributing: boolean;
  criticalPathTop: Array<{ id: string; duration: number }>;
}

/** A speed lever that knows the run shape it applies to and the advice it yields. */
interface LeverCandidate {
  /** Whether this lever diagnoses the run's bottleneck. */
  isApplicable(c: RecommendationContext): boolean;
  /** The advice to show; may be empty when the lever applies but its only fix is CI-gated. */
  build(c: RecommendationContext): Recommendation[];
}

/**
 * Mutually-exclusive speed levers, highest priority first. The first whose `isApplicable`
 * is true wins — even when its `build` yields nothing (a machine-bound run outside CI has
 * no local fix, but the bottleneck is still diagnosed, so the critical-path fallback is
 * skipped). When none applies the run is critical-path-bound.
 */
const LEVER_CANDIDATES: LeverCandidate[] = [
  {
    // Already on agents: more agents (not local --parallel) is the parallelism lever.
    isApplicable: (c) =>
      c.distributing &&
      c.runDuration > 0 &&
      c.recoverable >= PARALLEL_LEAD_FRACTION * c.runDuration,
    build: (c) => [
      [`Add more Nx Agents to recover up to ${formatDuration(c.recoverable)}.`],
    ],
  },
  {
    // Slot-bound with spare cores: the lever is local --parallel. Whole-phrase link to the
    // perf docs (the same page the footer points at, so the footer drops when this shows);
    // the period stays outside the link.
    isApplicable: (c) =>
      !c.distributing &&
      c.runDuration > 0 &&
      c.recoverableByParallel >= PARALLEL_LEAD_FRACTION * c.runDuration &&
      c.recoverableByParallel >= c.recoverableByMachines,
    build: (c) => [
      [
        phraseLink(
          `Increase parallelism to recover up to ${formatDuration(
            c.recoverableByParallel
          )}`,
          NX_PERFORMANCE_LINK
        ),
        `.`,
      ],
    ],
  },
  {
    // At the core ceiling and still queuing. Agents for CPU-bound work; otherwise only the
    // I/O-bound --parallel tip applies.
    isApplicable: (c) =>
      !c.distributing &&
      c.recoverableByMachines >= MEANINGFUL_OVERHEAD &&
      c.parallel >= c.cores,
    build: (c) => {
      const base = `You're at this machine's ${c.cores} ${pluralize(
        c.cores,
        'core'
      )} and tasks are still queuing for a slot.`;
      return [
        c.canDistribute
          ? [
              `${base} If they're CPU-bound, distribute across machines with Nx Agents → `,
              agentsLink,
              `; if they're I/O-bound, a higher --parallel may help instead.`,
            ]
          : [`${base} If they're I/O-bound, a higher --parallel may help.`],
      ];
    },
  },
  {
    // Below the core ceiling but still machine-bound (a parallelism:false task monopolizes
    // the pool, or volume exceeds the cores): only more machines can free those slots, and
    // that lever only exists in CI.
    isApplicable: (c) =>
      !c.distributing &&
      c.recoverableByMachines >= MEANINGFUL_OVERHEAD &&
      c.parallel < c.cores,
    build: (c) =>
      c.canDistribute
        ? [
            [
              `Tasks are queuing for a slot that a higher --parallel can't free on one machine. Distribute across machines with Nx Agents → `,
              agentsLink,
              `.`,
            ],
          ]
        : [],
  },
  {
    // Coordinator-dominated (tasks fast or cached), machine ~maxed: in CI agents are the
    // only lever; locally nothing actionable.
    isApplicable: (c) =>
      !c.distributing &&
      c.recoverableByMachines < MEANINGFUL_OVERHEAD &&
      c.coordinatorDominated,
    build: (c) =>
      c.canDistribute
        ? [
            [
              `This run was about as fast as this machine can do it. Distribute the work across multiple machines with Nx Agents to make it faster → `,
              agentsLink,
              `.`,
            ],
          ]
        : [],
  },
];

/** Actionable levers to go faster, one rec per lever (see {@link LEVER_CANDIDATES}). When no lever applies the run is critical-path-bound: shorten the chain's longest tasks, and — only in CI when it recovers at least {@link PARALLEL_LEAD_FRACTION} of the run — distribute the rest. */
export function buildRecommendation(args: {
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorDominated: boolean;
  runDuration: number;
  parallel: number;
  cores: number;
  canDistribute: boolean;
  distributing: boolean;
  criticalPathTop: Array<{ id: string; duration: number }>;
}): Recommendation[] {
  const c: RecommendationContext = {
    ...args,
    recoverable: args.recoverableByParallel + args.recoverableByMachines,
  };

  const lever = LEVER_CANDIDATES.find((candidate) => candidate.isApplicable(c));
  if (lever) {
    return lever.build(c);
  }
  // Critical-path-bound: shorten the chain's longest tasks and distribute the rest.
  // Nothing ran (fully cached) → no rec.
  if (c.criticalPathTop.length === 0) {
    return [];
  }
  const speedUp: Recommendation = [
    [
      `Speed up or split the longest tasks on the critical path:`,
      ...formatTopTaskRows(c.criticalPathTop),
    ].join('\n'),
  ];
  const recommendations: Recommendation[] = [speedUp];
  // Only distribute when it can recover a meaningful slice of the run; a sequential chain
  // (nothing recoverable) gains nothing from more machines.
  if (
    c.canDistribute &&
    c.runDuration > 0 &&
    c.recoverable >= PARALLEL_LEAD_FRACTION * c.runDuration
  ) {
    recommendations.push([
      `Distribute tasks across multiple machines with Nx Agents to increase parallelism without overwhelming resource usage → `,
      agentsLink,
      `.`,
    ]);
  }
  return recommendations;
}

/**
 * Recommendations in display order, cheapest first: "recover up to X" → remote-cache
 * → other levers → "speed up / split" LAST (deepest manual work, the only multi-line
 * rec). Shared by the report and TUI payload.
 */
function orderedRecommendations(s: PerformanceSummary): Recommendation[] {
  const levers = [...s.structuredRecommendations];
  const cacheAdvice = buildCacheAdvice(s);
  // Classify by the rec's plain text — the structured link parts don't affect order.
  const text = recommendationToPayloadString;
  const isRecoverLever = (r: Recommendation) =>
    text(r).includes('recover up to');
  const isLongestTasks = (r: Recommendation) => text(r).includes('\n');
  return [
    ...levers.filter(isRecoverLever),
    ...(cacheAdvice ? [cacheAdvice] : []),
    ...levers.filter((r) => !isRecoverLever(r) && !isLongestTasks(r)),
    ...levers.filter(isLongestTasks),
  ];
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

/**
 * Bottom-of-report cache advice, only when there's a lever: a skipped cache (drop
 * the flag) or a barely-used cache with no remote (set up Nx Cloud).
 */
function buildCacheAdvice(s: PerformanceSummary): Recommendation | null {
  if (s.cacheSkipped) {
    return [
      `Cache: drop --skip-nx-cache to restore unchanged tasks instantly.`,
    ];
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  const hitRate = s.cacheHits / s.cacheableCount;
  if (!s.remoteCacheEnabled && hitRate <= LOW_CACHE_HIT_RATE) {
    // Whole-phrase link: the sentence is the visible text, the tagged URL the
    // target. The payload string stays URL-less (the popup re-links the phrase).
    return [phraseLink(NX_REMOTE_CACHE_CTA, NX_REMOTE_CACHE_LINK), `.`];
  }
  return null;
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
  const recommendations = orderedRecommendations(s);
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
  // utm-tagged footer (a url link): with OSC 8 the clean URL shows and hides the utm
  // in the target; without it the tagged URL prints verbatim. Dropped when a rec
  // already links to the same perf docs page (e.g. the parallelism lever).
  if (shouldShowFooter(recommendations)) {
    const footer: Recommendation = [
      `  ${NX_PERFORMANCE_LABEL} → `,
      urlLink(NX_PERFORMANCE_URL, NX_PERFORMANCE_LINK),
    ];
    lines.push('', render(footer));
  }
  // No trailing newline — the caller's console.log adds the line terminator.
  return lines.join('\n');
}

/** A task that failed during the run, for the GitHub Actions summary's failed-tasks table. */
export interface FailedTask {
  id: string;
  duration: number;
}

/**
 * A recommendation as Markdown: every link becomes `[text](href)` (no OSC 8, unlike the
 * terminal renderer). A phrase link reads as prose, so the whole sentence is the link
 * text; a url link's visible text is the bare URL (a terminal affordance for shells
 * without OSC 8), so Markdown gives it a readable "Learn more" label instead — the href
 * already carries the destination. The critical-path rec embeds newline-separated,
 * space-aligned task rows; collapse them to `<br>`-joined lines so they render inside the
 * list item.
 */
function recommendationToMarkdownString(rec: Recommendation): string {
  return rec
    .map((part) => {
      if (!isRecLink(part)) {
        return part;
      }
      const text = part.style === 'phrase' ? part.visible : 'Learn more';
      return `[${text}](${part.href})`;
    })
    .join('')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('<br>');
}

/** Escape the Markdown table cell delimiter so a task id containing `|` can't break the row. */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/**
 * The performance report as GitHub-flavored Markdown for the Actions job summary
 * (`$GITHUB_STEP_SUMMARY`). Mirrors {@link formatReport}'s content — the same stats and
 * recommendations — and, when the run had failures, surfaces them in a Failed tasks table
 * (the terminal report has no table). Links render as Markdown links rather than OSC 8
 * hyperlinks.
 *
 * `command` (the nx command, e.g. `run-many -t build`) is appended to the heading so
 * stacked reports from multiple nx commands in one job summary stay distinguishable.
 */
export function formatReportMarkdown(
  s: PerformanceSummary,
  failedTasks: FailedTask[],
  command = ''
): string {
  const fmt = formatDuration;
  const recoverable = recoverableTime(s);
  const recoverablePct =
    s.runDuration > 0 ? Math.round((recoverable / s.runDuration) * 100) : 0;
  const cache = cacheStat(s);

  // Headline stats as a borderless two-column table, mirroring the terminal stat lines.
  const lines = [
    command
      ? `## ⚡ Nx Performance Report — \`${command}\``
      : '## ⚡ Nx Performance Report',
    '',
    '| | |',
    '| :-- | :-- |',
    `| **Run duration** | ${fmt(s.runDuration)} |`,
    ...(cache ? [`| **Cache** | ${cache} |`] : []),
    `| **Critical path** | ${fmt(s.criticalPathDuration)} (${
      s.criticalPathTaskCount
    } ${pluralize(s.criticalPathTaskCount, 'task')}) |`,
    `| **Recoverable time** | ${
      recoverable > 0
        ? `${fmt(recoverable)} (${recoverablePct}% of the run)`
        : fmt(recoverable)
    } |`,
  ];

  // The failures are the actionable part of a CI summary, so list them (slowest first)
  // right under the stats. A green run shows no table at all.
  if (failedTasks.length > 0) {
    lines.push(
      '',
      `### ❌ Failed tasks (${failedTasks.length})`,
      '',
      '| Task | Duration |',
      '| :-- | --: |',
      ...failedTasks.map(
        (t) => `| \`${escapeTableCell(t.id)}\` | ${fmt(t.duration)} |`
      )
    );
  }

  const recommendations = orderedRecommendations(s);
  if (recommendations.length > 0) {
    lines.push('', '### Recommendations', '');
    for (const rec of recommendations) {
      lines.push(`- ${recommendationToMarkdownString(rec)}`);
    }
  }

  if (shouldShowFooter(recommendations)) {
    lines.push('', `[${NX_PERFORMANCE_LABEL}](${NX_PERFORMANCE_LINK})`);
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
  const recommendations = orderedRecommendations(s);
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
    // Dropped when a rec already links to the same perf docs page (the popup then
    // renders no footer bullet).
    footer: shouldShowFooter(recommendations)
      ? { text: NX_PERFORMANCE_LABEL, href: NX_PERFORMANCE_LINK }
      : undefined,
    // Phrase links (e.g. the remote-cache CTA) carry their href as data so the
    // popup hyperlinks the phrase in place; surfaced only when shown.
    links: recommendationLinks(recommendations),
  };
}
