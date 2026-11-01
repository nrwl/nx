/**
 * Parser for macOS `sample` command output.
 *
 * `sample` produces a weighted call tree where each line's count is the
 * number of times that frame was observed anywhere on the stack (inclusive).
 * Depth is encoded by the column position of the count — each level adds 2
 * characters of prefix (tree drawing chars + spaces).
 *
 * Self-time for a node = node.count - sum(direct children counts).
 * This is the number of samples where execution was *in* this frame's own
 * code rather than in one of its callees.
 */
import { readFileSync } from 'fs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SampleHotSpot {
  name: string;
  library: string;
  selfSamples: number;
  selfPct: number;
  /** Max inclusive count across all call sites for this function */
  totalSamples: number;
  /** Immediate ancestors, innermost last (same order as perf-cpu-profile) */
  callerChain: string[];
}

export interface ThreadSummary {
  name: string;
  samples: number;
  isMain: boolean;
}

export interface LibraryBreakdown {
  library: string;
  selfSamples: number;
  selfPct: number;
}

export interface SampleReport {
  totalSamples: number; // sum of self-samples across all threads
  mainThreadSamples: number;
  threads: ThreadSummary[];
  /** Hot spots sorted by self-samples descending */
  hotSpots: SampleHotSpot[];
  /** Library breakdown by self-samples, descending */
  libraryBreakdown: LibraryBreakdown[];
}

// ── Internal tree node ────────────────────────────────────────────────────────

interface TreeNode {
  count: number;
  name: string;
  library: string;
  depth: number; // column-position-based depth
  children: TreeNode[];
  parent: TreeNode | null;
}

// ── Frame parsing ─────────────────────────────────────────────────────────────

// Frames that are pure call-chain boilerplate — not useful as "hot spots"
// but still appear in caller chains.
const BOILERPLATE_RE =
  /^(?:start|main|_mh_execute_header|Thread_|thread_start|_pthread_start|Builtins_JSEntry(?:Trampoline)?$|Builtins_JSRunMicrotasksEntry|node::Start|node::NodeMainInstance|node::SpinEventLoop)/;

/**
 * Parse a single call-tree frame line.
 * Returns null for lines that are not frame entries (headers, blank, etc.).
 */
function parseLine(line: string): {
  depth: number;
  count: number;
  name: string;
  library: string;
  isThreadHeader: boolean;
} | null {
  // Find the first digit — its column position encodes depth.
  const digitIdx = line.search(/\d/);
  if (digitIdx < 0) return null;

  // The baseline column for depth=0 (thread headers) is 4 spaces.
  // Each tree level adds 2 chars. depth = (digitIdx - 4) / 2, clamped to ≥ 0.
  const depth = Math.max(0, Math.floor((digitIdx - 4) / 2));

  // Extract count + the rest of the line
  const rest = line.slice(digitIdx);
  const countMatch = rest.match(/^(\d+)\s+(.*)/);
  if (!countMatch) return null;

  const count = parseInt(countMatch[1], 10);
  const frameText = countMatch[2].trim();

  // Thread header: "Thread_<id>  DispatchQueue_N: <queue-name>  (serial)" or "Thread_<id>: <name>" or "Thread_<id>"
  if (frameText.startsWith('Thread_')) {
    // Preserve the dispatch queue name if present — it identifies the main thread
    const dispatchMatch = frameText.match(/DispatchQueue_\d+:\s*([^\s(]+)/);
    const threadBase = frameText.replace(/\s+DispatchQueue_.*$/, '').trim();
    const threadName = dispatchMatch
      ? `${threadBase} [${dispatchMatch[1]}]`
      : threadBase;
    return {
      depth,
      count,
      name: threadName,
      library: '(thread)',
      isThreadHeader: true,
    };
  }

  // Regular frame: "<name>  (in <library>) + <offset>  [<addr>]"
  // or:            "<name>  (in <library>)  [<addr>]"
  // or:            "<name>  [<addr>]"  (no library)
  // or:            "???"
  const inMatch = frameText.match(/^(.*?)\s+\(in ([^)]+)\)/);
  let name: string;
  let library: string;

  if (inMatch) {
    // Strip C++ template noise and argument lists for readability
    name = cleanName(inMatch[1]);
    library = cleanLibrary(inMatch[2]);
  } else {
    // No "(in ...)" clause — could be "???" or a raw symbol
    name = cleanName(
      frameText
        .replace(/\s+\[0x[0-9a-f]+\].*$/, '')
        .replace(/\s+\+\s+\d+$/, '')
        .trim()
    );
    library = '(unknown)';
  }

  return { depth, count, name, library, isThreadHeader: false };
}

/** Shorten C++ / Rust symbol names to something readable. */
function cleanName(raw: string): string {
  // Strip trailing offset: " + 1234"
  let s = raw.replace(/\s+\+\s+\d+$/, '').trim();
  // Strip address: " [0x...]"
  s = s.replace(/\s+\[0x[0-9a-f]+\].*$/, '').trim();
  // Collapse Rust hash suffixes: ::h0123456789abcdef → (stripped)
  s = s.replace(/::h[0-9a-f]{16}$/i, '');
  // Shorten long Rust generic angle-bracket soup (keep outer type)
  s = s.replace(/_\$LT\$(.+?)\$GT\$/g, '<$1>');
  // Shorten anonymous namespace
  s = s.replace(/\(anonymous namespace\)::/g, '(anon)::');
  return s || '???';
}

/** Make library names shorter and consistent. */
function cleanLibrary(raw: string): string {
  // nx native module: strip version prefix
  if (raw.includes('.node')) {
    const m = raw.match(/([^/]+\.node)/);
    return m ? m[1] : raw;
  }
  // Strip full paths
  const base = raw.split('/').pop() ?? raw;
  return base;
}

// ── Tree builder ──────────────────────────────────────────────────────────────

/**
 * Build a forest of TreeNodes from the "Call graph:" section of `sample` output.
 * Each root is a thread-header node; children are the call frames under it.
 */
function buildForest(lines: string[]): TreeNode[] {
  const roots: TreeNode[] = [];
  // stack[i] = the node at depth i that is currently "open"
  const stack: TreeNode[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { depth, count, name, library, isThreadHeader } = parsed;

    const node: TreeNode = {
      count,
      name,
      library,
      depth,
      children: [],
      parent: null,
    };

    if (isThreadHeader) {
      // Thread headers are always roots
      roots.push(node);
      stack.length = 0;
      stack.push(node);
    } else {
      // Pop until we find the parent (a node with strictly smaller depth)
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      const parent = stack.length > 0 ? stack[stack.length - 1] : null;
      if (parent) {
        node.parent = parent;
        parent.children.push(node);
      }
      stack.push(node);
    }
  }

  return roots;
}

// ── Self-time aggregation ─────────────────────────────────────────────────────

type Aggregated = {
  name: string;
  library: string;
  selfSamples: number;
  bestTotalSamples: number;
  bestParentChain: string[];
};

function collectHotSpots(
  node: TreeNode,
  agg: Map<string, Aggregated>,
  parentChain: string[] = []
): void {
  // Self samples = this node's count minus sum of direct children counts
  const childrenTotal = node.children.reduce((s, c) => s + c.count, 0);
  const selfSamples = Math.max(0, node.count - childrenTotal);

  const key = `${node.library}|${node.name}`;
  const existing = agg.get(key);

  const chain = [...parentChain, node.name];

  if (selfSamples > 0) {
    if (!existing) {
      agg.set(key, {
        name: node.name,
        library: node.library,
        selfSamples,
        bestTotalSamples: node.count,
        // callerChain = ancestors above this node (innermost last)
        bestParentChain: parentChain.slice(-4),
      });
    } else {
      existing.selfSamples += selfSamples;
      if (node.count > existing.bestTotalSamples) {
        existing.bestTotalSamples = node.count;
        existing.bestParentChain = parentChain.slice(-4);
      }
    }
  }

  for (const child of node.children) {
    collectHotSpots(child, agg, chain.slice(-5));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseSampleFile(path: string): SampleReport {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {
      totalSamples: 0,
      mainThreadSamples: 0,
      threads: [],
      hotSpots: [],
      libraryBreakdown: [],
    };
  }

  // Extract everything between "Call graph:" and "Binary Images:" (or end of file)
  const callGraphStart = text.indexOf('Call graph:');
  if (callGraphStart < 0) {
    return {
      totalSamples: 0,
      mainThreadSamples: 0,
      threads: [],
      hotSpots: [],
      libraryBreakdown: [],
    };
  }
  const callGraphEnd = text.indexOf('\nBinary Images:', callGraphStart);
  const callGraphText =
    callGraphEnd > 0
      ? text.slice(callGraphStart + 'Call graph:'.length, callGraphEnd)
      : text.slice(callGraphStart + 'Call graph:'.length);

  const lines = callGraphText.split('\n');
  const roots = buildForest(lines);

  // ── Thread summary ───────────────────────────────────────────────────────────
  const isMainThread = (name: string) =>
    name.includes('Main Thread') || name.includes('com.apple.main-thread');

  const threads: ThreadSummary[] = roots.map((r) => ({
    name: r.name,
    samples: r.count,
    isMain: isMainThread(r.name),
  }));

  const mainThread = roots.find((r) => isMainThread(r.name));
  const mainThreadSamples = mainThread?.count ?? 0;

  // ── Hot spots (aggregate self-time across all threads) ───────────────────────
  const agg = new Map<string, Aggregated>();
  for (const root of roots) {
    collectHotSpots(root, agg);
  }

  const totalSamples = [...agg.values()].reduce((s, a) => s + a.selfSamples, 0);

  const hotSpots: SampleHotSpot[] = [...agg.values()]
    .filter((a) => a.selfSamples >= 2 && !BOILERPLATE_RE.test(a.name))
    .map((a) => ({
      name: a.name,
      library: a.library,
      selfSamples: a.selfSamples,
      selfPct: totalSamples > 0 ? (a.selfSamples / totalSamples) * 100 : 0,
      totalSamples: a.bestTotalSamples,
      callerChain: a.bestParentChain,
    }))
    .sort((a, b) => b.selfSamples - a.selfSamples);

  // ── Library breakdown ────────────────────────────────────────────────────────
  const libMap = new Map<string, number>();
  for (const s of hotSpots) {
    libMap.set(s.library, (libMap.get(s.library) ?? 0) + s.selfSamples);
  }
  const libraryBreakdown: LibraryBreakdown[] = [...libMap.entries()]
    .map(([library, selfSamples]) => ({
      library,
      selfSamples,
      selfPct: totalSamples > 0 ? (selfSamples / totalSamples) * 100 : 0,
    }))
    .sort((a, b) => b.selfSamples - a.selfSamples);

  return {
    totalSamples,
    mainThreadSamples,
    threads,
    hotSpots,
    libraryBreakdown,
  };
}

// ── Terminal renderer ─────────────────────────────────────────────────────────

const BAR_WIDTH = 24;

export function printSampleHotSpots(report: SampleReport, limit = 15): void {
  if (!report.hotSpots.length) {
    console.log('  (no sample data)\n');
    return;
  }
  const top = report.hotSpots[0].selfSamples;
  for (const s of report.hotSpots.slice(0, limit)) {
    const bar = '█'.repeat(Math.round((s.selfSamples / top) * BAR_WIDTH));
    const selfStr = `${s.selfSamples}`.padStart(6);
    const pctStr = `${s.selfPct.toFixed(1)}%`.padStart(6);
    const chain =
      s.callerChain.length > 0 ? `← ${s.callerChain.join(' ← ')}` : '';
    console.log(`  ${s.name.padEnd(48)} ${selfStr}  ${pctStr}  ${bar}`);
    console.log(`    \x1b[2m[${s.library}]  ${chain}\x1b[0m`);
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

export function buildSampleMarkdownSection(
  report: SampleReport,
  limit = 30,
  pid?: number,
  role?: string
): string {
  if (!report.hotSpots.length) return '';

  // Helpers
  const pct = (n: number) => `${n.toFixed(1)}%`;
  const bar = (n: number, top: number) =>
    '█'.repeat(Math.round((n / Math.max(top, 1)) * 16));

  // ── Thread table ─────────────────────────────────────────────────────────────
  const threadRows = report.threads
    .slice(0, 12)
    .map((t) => `| ${t.name} | ${t.samples} | ${t.isMain ? '✓ main' : ''} |`);

  const threadTable = [
    '| Thread | Samples | Role |',
    '| ------ | ------: | ---- |',
    ...threadRows,
  ].join('\n');

  // ── Library breakdown table ───────────────────────────────────────────────────
  const libRows = report.libraryBreakdown
    .slice(0, 10)
    .map(
      (l) =>
        `| \`${l.library}\` | ${l.selfSamples} | ${pct(l.selfPct)} | ${bar(l.selfSamples, report.libraryBreakdown[0].selfSamples)} |`
    );

  const libTable = [
    '| Library | Self samples | Self % | |',
    '| ------- | -----------: | -----: | - |',
    ...libRows,
  ].join('\n');

  // ── Hot spots table ───────────────────────────────────────────────────────────
  // Truncate very long C++ symbol names for table readability
  const truncSym = (sym: string, max = 60) =>
    sym.length > max ? sym.slice(0, max - 1) + '…' : sym;

  const spotRows = report.hotSpots.slice(0, limit).map((s) => {
    const chain =
      s.callerChain.length > 0
        ? s.callerChain.map((c) => truncSym(c, 40)).join(' → ')
        : '—';
    return (
      `| \`${truncSym(s.name)}\` ` +
      `| \`${s.library}\` ` +
      `| ${s.selfSamples} ` +
      `| ${pct(s.selfPct)} ` +
      `| ${s.totalSamples} ` +
      `| ${chain} |`
    );
  });

  const spotsTable = [
    '| Function | Library | Self~ | Self% | Total~ | Called from |',
    '| -------- | ------- | ----: | -----: | -----: | ----------- |',
    ...spotRows,
  ].join('\n');

  const label = role && pid ? `${role} (pid ${pid})` : (role ?? 'main process');

  return [
    '',
    `## System Profile — ${label} (macOS \`sample\`)`,
    '',
    `> Wall-clock sampling of the **${label}** at ~1 ms intervals.`,
    "> Covers native code, I/O waits, and kernel calls invisible to V8's profiler.",
    '> **Self~** = samples where this function was at the top of the stack (not in a callee).',
    '> **Total~** = samples where this function was anywhere on the stack.',
    '> Each sample ≈ 1 ms of wall-clock time.',
    '',
    `**Total samples:** ${report.totalSamples}  **Main thread:** ${report.mainThreadSamples}`,
    '',
    '### Threads',
    '',
    threadTable,
    '',
    '### Time by library',
    '',
    libTable,
    '',
    '### Hot spots (self-time, all threads)',
    '',
    '_Boilerplate frames (`start`, `node::Start`, V8 entry trampolines) are omitted._',
    '',
    spotsTable,
    '',
    `_Sampling interval ≈ 1 ms. Frames with < 2 samples self-time omitted. Showing ${Math.min(limit, report.hotSpots.length)} of ${report.hotSpots.length} functions._`,
  ].join('\n');
}
