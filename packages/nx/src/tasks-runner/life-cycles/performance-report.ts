import type { Link, PerformanceSummaryPayload } from '../../native';
import { supportsHyperlinks, terminalLink } from '../../utils/terminal-link';
import type { PerformanceSummary } from './performance-life-cycle';

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

/** Format a millisecond duration as e.g. "3m 30s", "13.4s", or "470ms". */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = Math.round(ms / 100) / 10;
  if (seconds >= 60) {
    const totalSeconds = Math.round(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

/** Append "s" unless `count` is 1 (regular plurals only). */
function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

function pluralizeCores(cores: number): string {
  return pluralize(cores, 'core');
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
function agentsLink(): RecLink {
  return urlLink(NX_AGENTS_URL, NX_AGENTS_LINK);
}

/** Actionable levers to go faster, one rec per lever. The critical-path case has two (shorten the chain, distribute the rest). Agents advice is omitted unless `canDistribute`. */
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
  const {
    recoverableByParallel,
    recoverableByMachines,
    coordinatorDominated,
    runDuration,
    parallel,
    cores,
    canDistribute,
    distributing,
    criticalPathTop,
  } = args;

  if (distributing) {
    // Already on agents: more agents (not local --parallel) is the parallelism lever;
    // the cores/machine framing below doesn't apply to a distributed run.
    const recoverable = recoverableByParallel + recoverableByMachines;
    if (
      runDuration > 0 &&
      recoverable >= PARALLEL_LEAD_FRACTION * runDuration
    ) {
      return [
        [`Add more Nx Agents to recover up to ${formatDuration(recoverable)}.`],
      ];
    }
  } else {
    // Slot-bound with spare cores: the lever is local --parallel, not agents.
    if (
      runDuration > 0 &&
      recoverableByParallel >= PARALLEL_LEAD_FRACTION * runDuration &&
      recoverableByParallel >= recoverableByMachines
    ) {
      return [
        [
          `Increase parallelism to recover up to ${formatDuration(
            recoverableByParallel
          )}.`,
        ],
      ];
    }
    // Machine-bound: contention a higher local --parallel can't recover.
    if (recoverableByMachines >= MEANINGFUL_OVERHEAD) {
      if (parallel >= cores) {
        // At the core ceiling and still queuing. Agents for CPU-bound work;
        // otherwise only the I/O-bound --parallel tip applies.
        const base = `You're at this machine's ${cores} ${pluralizeCores(
          cores
        )} and tasks are still queuing for a slot.`;
        return [
          canDistribute
            ? [
                `${base} If they're CPU-bound, distribute across machines with Nx Agents → `,
                agentsLink(),
                `; if they're I/O-bound, a higher --parallel may help instead.`,
              ]
            : [`${base} If they're I/O-bound, a higher --parallel may help.`],
        ];
      }
      // Below the core ceiling but still machine-bound (a parallelism:false task
      // monopolizes the pool, or volume exceeds the cores): only more machines can
      // free those slots, and that lever only exists in CI.
      return canDistribute
        ? [
            [
              `Tasks are queuing for a slot that a higher --parallel can't free on one machine. Distribute across machines with Nx Agents → `,
              agentsLink(),
              `.`,
            ],
          ]
        : [];
    }
    // Coordinator-dominated (tasks fast or cached), machine ~maxed: in CI agents are
    // the only lever; locally nothing actionable.
    if (coordinatorDominated) {
      return canDistribute
        ? [
            [
              `This run was about as fast as this machine can do it. Distribute the work across multiple machines with Nx Agents to make it faster → `,
              agentsLink(),
              `.`,
            ],
          ]
        : [];
    }
  }
  // Critical-path-bound: shorten the chain's longest tasks and distribute the rest.
  // Nothing ran (fully cached) → no rec.
  if (criticalPathTop.length === 0) {
    return [];
  }
  const speedUp: Recommendation = [
    [
      `Speed up or split the longest tasks on the critical path:`,
      ...formatTopTaskRows(criticalPathTop),
    ].join('\n'),
  ];
  const recommendations: Recommendation[] = [speedUp];
  if (canDistribute) {
    recommendations.push([
      `Distribute tasks across multiple machines with Nx Agents to increase parallelism without overwhelming resource usage → `,
      agentsLink(),
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
  const stat = (label: string, value: string) =>
    `  ${`${label}:`.padEnd(25)}  ${value}`;
  // No leading blank line: nx's run summary already prints trailing blanks before this.
  const cache = cacheStat(s);
  const lines = [
    stat('Run duration', fmt(s.runDuration)),
    ...(cache ? [stat('Cache', cache)] : []),
    stat(
      'Critical path',
      `${fmt(s.criticalPathDuration)}   (${
        s.criticalPathTaskCount
      } ${pluralize(s.criticalPathTaskCount, 'task')})`
    ),
    stat(
      'Recoverable time',
      recoverable > 0
        ? `${fmt(recoverable)}   (${recoverablePct}% of the run)`
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
  // in the target; without it the tagged URL prints verbatim.
  const footer: Recommendation = [
    `  ${NX_PERFORMANCE_LABEL} → `,
    urlLink(NX_PERFORMANCE_URL, NX_PERFORMANCE_LINK),
  ];
  lines.push('', render(footer));
  lines.push('');
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
    footer: { text: NX_PERFORMANCE_LABEL, href: NX_PERFORMANCE_LINK },
    // Phrase links (e.g. the remote-cache CTA) carry their href as data so the
    // popup hyperlinks the phrase in place; surfaced only when shown.
    links: recommendationLinks(recommendations),
  };
}
