import type { PerformanceSummaryPayload } from '../../native';
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
/** Visible URL ⇄ tagged target pairs for {@link linkify}. */
const REPORT_LINKS: ReadonlyArray<{ visible: string; href: string }> = [
  { visible: NX_PERFORMANCE_URL, href: NX_PERFORMANCE_LINK },
  { visible: NX_AGENTS_URL, href: NX_AGENTS_LINK },
];
/**
 * Whole-phrase CTA: the whole sentence is the link. The Rust TUI popup keeps no
 * copy of this string; it gets the phrase + href from the exit payload's `links`.
 */
const NX_REMOTE_CACHE_CTA =
  'Drastically reduce your run duration by sharing a cache across your team and CI';
const PHRASE_LINKS: ReadonlyArray<{ phrase: string; href: string }> = [
  { phrase: NX_REMOTE_CACHE_CTA, href: NX_REMOTE_CACHE_LINK },
];

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
}): string[] {
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
        `Add more Nx Agents to recover up to ${formatDuration(recoverable)}.`,
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
        `Increase parallelism to recover up to ${formatDuration(
          recoverableByParallel
        )}.`,
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
            ? `${base} If they're CPU-bound, distribute across machines with Nx Agents → ${NX_AGENTS_LINK}; if they're I/O-bound, a higher --parallel may help instead.`
            : `${base} If they're I/O-bound, a higher --parallel may help.`,
        ];
      }
      // Below the core ceiling but still machine-bound (a parallelism:false task
      // monopolizes the pool, or volume exceeds the cores): only more machines can
      // free those slots, and that lever only exists in CI.
      return canDistribute
        ? [
            `Tasks are queuing for a slot that a higher --parallel can't free on one machine. Distribute across machines with Nx Agents → ${NX_AGENTS_LINK}.`,
          ]
        : [];
    }
    // Coordinator-dominated (tasks fast or cached), machine ~maxed: in CI agents are
    // the only lever; locally nothing actionable.
    if (coordinatorDominated) {
      return canDistribute
        ? [
            `This run was about as fast as this machine can do it. Distribute the work across multiple machines with Nx Agents to make it faster → ${NX_AGENTS_LINK}.`,
          ]
        : [];
    }
  }
  // Critical-path-bound: shorten the chain's longest tasks and distribute the rest.
  // Nothing ran (fully cached) → no rec.
  if (criticalPathTop.length === 0) {
    return [];
  }
  const speedUp = [
    `Speed up or split the longest tasks on the critical path:`,
    ...formatTopTaskRows(criticalPathTop),
  ].join('\n');
  const recommendations = [speedUp];
  if (canDistribute) {
    recommendations.push(
      `Distribute tasks across multiple machines with Nx Agents to increase parallelism without overwhelming resource usage → ${NX_AGENTS_LINK}.`
    );
  }
  return recommendations;
}

/**
 * Recommendations in display order, cheapest first: "recover up to X" → remote-cache
 * → other levers → "speed up / split" LAST (deepest manual work, the only multi-line
 * rec). Shared by the report and TUI payload.
 */
function orderedRecommendations(s: PerformanceSummary): string[] {
  const levers = [...s.recommendations];
  const cacheAdvice = buildCacheAdvice(s);
  const isRecoverLever = (r: string) => r.includes('recover up to');
  const isLongestTasks = (r: string) => r.includes('\n');
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
function buildCacheAdvice(s: PerformanceSummary): string | null {
  if (s.cacheSkipped) {
    return `Cache: drop --skip-nx-cache to restore unchanged tasks instantly.`;
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  const hitRate = s.cacheHits / s.cacheableCount;
  if (!s.remoteCacheEnabled && hitRate <= LOW_CACHE_HIT_RATE) {
    // Whole sentence is the link (see PHRASE_LINKS / linkify).
    return `${NX_REMOTE_CACHE_CTA}.`;
  }
  return null;
}

/**
 * Make the report's docs links clickable on OSC 8 terminals (URL-links → clean-URL
 * hyperlink; phrase-links → whole-sentence hyperlinks). Without OSC 8 (CI, pipes) URLs
 * print verbatim and phrase-links get the URL appended. Terminal-only: never run over
 * the TUI popup strings — ratatui strips the escape bytes, so the popup re-creates the
 * links natively.
 */
function linkify(text: string): string {
  let out = text;
  if (!supportsHyperlinks()) {
    // No clickable target: surface each phrase-link's URL inline.
    for (const { phrase, href } of PHRASE_LINKS) {
      out = out.split(phrase).join(`${phrase} → ${href}`);
    }
    return out;
  }
  for (const { visible, href } of REPORT_LINKS) {
    out = out.split(href).join(terminalLink(visible, href));
  }
  for (const { phrase, href } of PHRASE_LINKS) {
    out = out.split(phrase).join(terminalLink(phrase, href));
  }
  return out;
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
  const recommendations = orderedRecommendations(s);
  // A rec may be multi-line (the critical-path one embeds a task list); indent
  // continuation lines under the bullet.
  const renderRec = (r: string): string[] => {
    const [first, ...rest] = r.split('\n');
    return [`    - ${first}`, ...rest.map((l) => `      ${l}`)];
  };
  if (recommendations.length > 0) {
    const onlySingleLine =
      recommendations.length === 1 && !recommendations[0].includes('\n');
    if (onlySingleLine) {
      lines.push('', `  Recommendation: ${linkify(recommendations[0])}`);
    } else {
      lines.push(
        '',
        '  Recommendations:',
        ...recommendations.flatMap((r) => renderRec(linkify(r)))
      );
    }
  }
  // utm-tagged footer: linkify hides the utm in the OSC 8 target; without OSC 8 the
  // tagged URL prints verbatim.
  lines.push('', linkify(`  ${NX_PERFORMANCE_LABEL} → ${NX_PERFORMANCE_LINK}`));
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
    recommendations,
    footer: { text: NX_PERFORMANCE_LABEL, href: NX_PERFORMANCE_LINK },
    // The remote-cache CTA is a whole-phrase link; surface it for the popup only
    // when that rec is actually shown (matches the terminal report).
    links: recommendations.some((r) => r.includes(NX_REMOTE_CACHE_CTA))
      ? [{ text: NX_REMOTE_CACHE_CTA, href: NX_REMOTE_CACHE_LINK }]
      : [],
  };
}
