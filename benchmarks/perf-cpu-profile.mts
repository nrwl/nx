/**
 * Parses a V8 .cpuprofile file into a self-time + call-chain report.
 *
 * V8's CPU profiler is a sampling profiler: every ~1ms it records which
 * function is at the top of the call stack. The profile stores:
 *
 *   nodes[]      — call-frame tree (each node has children[])
 *   samples[]    — node IDs sampled at each interval (the top-of-stack frame)
 *   timeDeltas[] — microseconds elapsed since the previous sample
 *
 * Two key metrics:
 *
 *   SELF time  — sum of timeDeltas[i] where samples[i] == nodeId
 *                "How much CPU was spent executing this function's own code?"
 *                A low self-time means the function is just a dispatcher.
 *
 *   TOTAL time — self-time + total-time of all children
 *                "How much CPU was spent while this function was on the stack?"
 *                High total / low self = the function's callees are the real cost.
 *
 * The call chain (parent frames) is also recorded so you can see WHERE in the
 * program each hot leaf lives, without needing to open a flame graph tool.
 */
import { readFileSync } from 'fs';
import { relative } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CpuProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  children?: number[];
}

interface CpuProfile {
  nodes: CpuProfileNode[];
  samples: number[];
  timeDeltas: number[]; // microseconds between each sample
  startTime: number;
  endTime: number;
}

export interface CpuHotSpot {
  name: string;
  /** Repo-relative path, 'node:*', or '(native)' */
  url: string;
  line: number;
  /** CPU spent in this function's own code (excludes callees) */
  selfMs: number;
  selfPct: number;
  /** CPU spent while this function was anywhere on the stack */
  totalMs: number;
  totalPct: number;
  /**
   * Number of contiguous sample runs where this node was the top-of-stack
   * frame. Lower-bound estimate of invocation count — only counts calls that
   * lasted long enough to be sampled (~1 ms). Fast sub-ms calls will be
   * undercounted; use `avgSelfMs` to spot the pattern.
   */
  sampleRuns: number;
  /** selfMs / sampleRuns — average self-time per sampled invocation */
  avgSelfMs: number;
  /**
   * Immediate ancestor frames, innermost last.
   * e.g. ["hashMultipleTasks", "getHashPlan"] means
   *   getHashPlan called this function, and hashMultipleTasks called getHashPlan.
   */
  callerChain: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Frames whose self-time is uninteresting unless very large
const NOISE_FRAME_RE =
  /^\(root\)$|^\(garbage collector\)$|^\(program\)$|^\(idle\)$|^<anonymous>$/;

function shortenUrl(url: string, repoRoot: string): string {
  if (url.startsWith('file://')) {
    const abs = decodeURIComponent(url.slice(7));
    return relative(repoRoot, abs);
  }
  if (url.startsWith('node:')) return url;
  if (!url) return '(native)';
  return url;
}

// ── Core parser ───────────────────────────────────────────────────────────────

export function parseCpuProfile(
  profilePath: string,
  repoRoot: string
): CpuHotSpot[] {
  let profile: CpuProfile;
  try {
    profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch {
    return [];
  }
  if (!profile.samples?.length) return [];

  const nodeMap = new Map<number, CpuProfileNode>(
    profile.nodes.map((n) => [n.id, n])
  );

  // ── Build parent map ───────────────────────────────────────────────────────
  // V8's tree is stored as children[], so we invert it for ancestor traversal.
  const parentId = new Map<number, number>();
  for (const node of profile.nodes) {
    for (const childId of node.children ?? []) {
      parentId.set(childId, node.id);
    }
  }

  // ── Accumulate self-time (µs) and sample-run count per node ──────────────
  // A "sample run" is a contiguous block of samples where this node is at the
  // top of the stack — each transition into a node starts a new run. This is a
  // lower-bound estimate of call count: fast sub-ms calls are invisible to the
  // ~1ms sampler, but calls long enough to be sampled each contribute ≥1 run.
  const selfUs = new Map<number, number>();
  const sampleRunsMap = new Map<number, number>();
  let prevSampleId = -1;
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    const delta = profile.timeDeltas[i] ?? 0;
    selfUs.set(id, (selfUs.get(id) ?? 0) + delta);
    if (id !== prevSampleId) {
      sampleRunsMap.set(id, (sampleRunsMap.get(id) ?? 0) + 1);
    }
    prevSampleId = id;
  }

  // ── Compute total-time per node via bottom-up DFS ─────────────────────────
  // total(node) = self(node) + sum(total(child) for child in node.children)
  const totalUs = new Map<number, number>();
  function computeTotal(id: number): number {
    if (totalUs.has(id)) return totalUs.get(id)!;
    const node = nodeMap.get(id);
    const self = selfUs.get(id) ?? 0;
    const childrenTotal = (node?.children ?? []).reduce(
      (s, cid) => s + computeTotal(cid),
      0
    );
    const total = self + childrenTotal;
    totalUs.set(id, total);
    return total;
  }
  for (const node of profile.nodes) {
    computeTotal(node.id);
  }

  const wallUs =
    profile.timeDeltas.reduce((s, d) => s + d, 0) ||
    profile.endTime - profile.startTime;

  // ── Build call chain for a node (innermost caller last) ───────────────────
  function callerChain(nodeId: number, maxDepth = 5): string[] {
    const chain: string[] = [];
    let cur = parentId.get(nodeId);
    while (cur != null && chain.length < maxDepth) {
      const n = nodeMap.get(cur);
      if (!n) break;
      const name = n.callFrame.functionName;
      // Stop at the invisible (root) frame
      if (!name || NOISE_FRAME_RE.test(name)) break;
      chain.unshift(name);
      cur = parentId.get(cur);
    }
    return chain;
  }

  // ── Aggregate by (functionName + url + line) across all call sites ─────────
  // A function can appear in multiple places in the tree; sum self-times and
  // pick the largest-total occurrence as the representative call chain.
  type Key = string;
  const aggregated = new Map<
    Key,
    { selfUs: number; runs: number; bestTotalUs: number; bestChain: string[]; node: CpuProfileNode }
  >();

  for (const [id, us] of selfUs) {
    if (us < 500) continue; // < 0.5ms — noise floor
    const node = nodeMap.get(id);
    if (!node) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    if (NOISE_FRAME_RE.test(functionName) && us < 5000) continue;

    const key: Key = `${functionName}|${url}|${lineNumber}`;
    const existing = aggregated.get(key);
    const thisTotal = totalUs.get(id) ?? 0;
    const runs = sampleRunsMap.get(id) ?? 1;

    if (!existing) {
      aggregated.set(key, {
        selfUs: us,
        runs,
        bestTotalUs: thisTotal,
        bestChain: callerChain(id),
        node,
      });
    } else {
      existing.selfUs += us;
      existing.runs += runs;
      if (thisTotal > existing.bestTotalUs) {
        existing.bestTotalUs = thisTotal;
        existing.bestChain = callerChain(id);
      }
    }
  }

  const spots: CpuHotSpot[] = [];
  for (const [, entry] of aggregated) {
    const { callFrame } = entry.node;
    const selfMs = entry.selfUs / 1000;
    spots.push({
      name: callFrame.functionName || '(anonymous)',
      url: shortenUrl(callFrame.url, repoRoot),
      line: callFrame.lineNumber,
      selfMs,
      selfPct: wallUs > 0 ? (entry.selfUs / wallUs) * 100 : 0,
      totalMs: entry.bestTotalUs / 1000,
      totalPct: wallUs > 0 ? (entry.bestTotalUs / wallUs) * 100 : 0,
      sampleRuns: entry.runs,
      avgSelfMs: entry.runs > 0 ? selfMs / entry.runs : selfMs,
      callerChain: entry.bestChain,
    });
  }

  return spots.sort((a, b) => b.selfMs - a.selfMs);
}

// ── Terminal renderer ─────────────────────────────────────────────────────────

const BAR_WIDTH = 24;

export function printCpuHotSpots(spots: CpuHotSpot[], limit = 20): void {
  if (!spots.length) {
    console.log('  (no CPU sampling data)\n');
    return;
  }
  const topMs = spots[0].selfMs;
  for (const s of spots.slice(0, limit)) {
    const bar = '█'.repeat(Math.round((s.selfMs / topMs) * BAR_WIDTH));
    const loc = s.line >= 0 ? `${s.url}:${s.line + 1}` : s.url;
    const selfStr = `${s.selfMs.toFixed(1)}ms`.padStart(9);
    const pctStr = `${s.selfPct.toFixed(1)}%`.padStart(6);
    const callStr = `×${s.sampleRuns}`.padStart(6);
    const avgStr = `~${s.avgSelfMs.toFixed(2)}ms/call`;
    const chain = s.callerChain.length > 0 ? `← ${s.callerChain.join(' ← ')}` : '';
    console.log(`  ${s.name.padEnd(38)} ${selfStr}  ${pctStr}  ${callStr}  ${avgStr}  ${bar}`);
    console.log(`    \x1b[2m${loc}  ${chain}\x1b[0m`);
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

export function buildCpuMarkdownSection(
  spots: CpuHotSpot[],
  limit = 40
): string {
  if (!spots.length) return '';

  const rows = spots.slice(0, limit).map((s) => {
    const loc = s.line >= 0 ? `${s.url}:${s.line + 1}` : s.url;
    const chain =
      s.callerChain.length > 0 ? s.callerChain.join(' → ') : '—';
    // Flag wrappers: self < 5% of total means it's mostly dispatching to callees
    const selfNote =
      s.totalMs > 0 && s.selfMs / s.totalMs < 0.05 ? ' ⚡' : '';
    return (
      `| \`${s.name}\`${selfNote} ` +
      `| ${s.selfMs.toFixed(1)} ` +
      `| ${s.selfPct.toFixed(1)}% ` +
      `| ${s.totalMs.toFixed(1)} ` +
      `| ${s.sampleRuns} ` +
      `| ${s.avgSelfMs.toFixed(2)} ` +
      `| ${chain} ` +
      `| \`${loc}\` |`
    );
  });

  return [
    '',
    '## CPU Hot Spots (V8 sampling profiler, self-time)',
    '',
    '> **Self time** = CPU spent in this function\'s own code (callees excluded).',
    '> **Calls~** = sample runs (lower-bound invocation count; sub-ms calls undercounted).',
    '> **Avg ms** = self ms ÷ calls — average time per sampled invocation.',
    '> A ⚡ label means self < 5% of total — the function is mostly a dispatcher; look at callees.',
    '',
    '| Function | Self ms | Self % | Total ms | Calls~ | Avg ms | Called from | Location |',
    '| -------- | ------: | -----: | -------: | -----: | -----: | ----------- | -------- |',
    ...rows,
    '',
    '_Sampling interval ≈ 1 ms. Frames with < 0.5 ms self-time omitted._',
  ].join('\n');
}
