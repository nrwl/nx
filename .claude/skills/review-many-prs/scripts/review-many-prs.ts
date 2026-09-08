/**
 * review-many-prs — fan `/review-pr` out across herdr tabs under a slot budget.
 *
 * Run with: tsx .claude/skills/review-many-prs/scripts/review-many-prs.ts <pr>...
 *
 * A slot is held from `herdr agent start` until the child parks at review-pr's
 * Step 8.5 grill, and is never reclaimed after that: answering the grill sends the
 * child back to `working`, but the review and its sandbox work are already paid for.
 * That one-way property is structural here — `reviewOne` releases in a `finally` and
 * has returned by then, so there is no live code path that could take a slot back.
 *
 * Children are watched by BLOCKING on herdr, never by polling it. What counts as
 * "parked" is still the DRAFT on disk, because herdr's `blocked` cannot tell the
 * grill from a permission dialog, and secreq's out-of-band gh consent never reaches
 * `blocked` at all. See SKILL.md.
 */
import { execFile, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONCURRENCY = int(process.env.CONCURRENCY, 3);
const TRIAGE_DIR =
  process.env.TRIAGE_DIR ?? path.join(os.homedir(), '.nx-pr-reviews');
const REPO = process.env.NX_REPO_PATH ?? path.join(os.homedir(), 'repos', 'nx');
const TICK_MS = int(process.env.TICK_SECS, 30) * 1000;
const SETTLE_TIMEOUT_MS = int(process.env.SETTLE_TIMEOUT_MS, 60 * 60 * 1000);
const RESUME_TIMEOUT_MS = int(
  process.env.RESUME_TIMEOUT_MS,
  24 * 60 * 60 * 1000
);
const DISK_RESERVE_GB = int(process.env.DISK_RESERVE_GB, 12);
// Cost of the FIRST review in a cold shared container — the one that pays the
// store copy-up. Later reviews measure ~0.5 GB, but seeding with that would let
// a cold batch launch three at once against a budget only one of them fits.
const SEED_SANDBOX_GB = int(process.env.SEED_SANDBOX_GB, 6);
const PRUNE_AT_END = process.env.PRUNE_AT_END !== '0';
// review-pr reads REVIEW_NONINTERACTIVE from its own process env, and a child runs in a
// fresh herdr pane that does not inherit ours — so it has to be forwarded at tab create.
const NONINTERACTIVE = process.env.REVIEW_NONINTERACTIVE === '1';
// "Settled having done nothing" and "not started yet" are the same herdr output while a
// child is booting, so a terminal read is only believable once the child has been seen
// working or this floor has passed. Measured misfires: 2026-08-31 killed 3/3 on a
// transient `gone`, 2026-08-28 killed 2/2 on a transient `idle`.
const MIN_RUN_SECS = int(process.env.MIN_RUN_SECS, 90);

type PrState =
  | 'queued'
  | 'running'
  | 'needs-input'
  | 'awaiting-grill'
  | 'throttled'
  | 'failed'
  | 'skipped';

interface Pr {
  number: number;
  title: string;
  headSha: string;
  state: PrState;
  note: string;
  tab?: string;
  pane?: string;
  /** Set once the child has been observed `working` — see `startupGrace`. */
  sawWorking?: boolean;
  /** Epoch seconds at `agent start`; the draft must be newer than this to count. */
  startedAt: number;
  /** What to send the child. Differs for a draft PR opened in with --include-drafts. */
  prompt: string;
}

type Outcome =
  | { kind: 'parked'; verdict: string }
  | { kind: 'failed'; note: string };

// ---------------------------------------------------------------- slot pool

interface Slot {
  release(): void;
}

/**
 * A counting semaphore of N slots. `acquire()` is the promise a caller awaits to
 * get one; a freed permit is handed straight to the longest-waiting caller rather
 * than round-tripping through the counter, so acquisition order is FIFO.
 */
export class SlotPool {
  private free: number;
  private waiters: Array<(slot: Slot) => void> = [];

  constructor(size: number) {
    this.free = size;
  }

  acquire(): Promise<Slot> {
    if (this.free > 0) {
      this.free--;
      return Promise.resolve(this.mint());
    }
    return new Promise<Slot>((resolve) => this.waiters.push(resolve));
  }

  private mint(): Slot {
    let spent = false;
    return {
      release: () => {
        if (spent) return; // releasing twice must not conjure a permit
        spent = true;
        const next = this.waiters.shift();
        if (next) next(this.mint());
        else this.free++;
      },
    };
  }
}

// ------------------------------------------------------------------ processes

interface Ran {
  code: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[], cwd = REPO): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    );
  });
}

/** herdr answers with JSON on stdout, and reports errors as JSON on STDERR with exit 1. */
async function herdr(
  args: string[]
): Promise<{ ok: boolean; json: any; errCode: string }> {
  const { code, stdout, stderr } = await run('herdr', args);
  let json: any = null;
  try {
    json = JSON.parse(stdout || stderr || 'null');
  } catch {
    /* non-JSON output (e.g. `agent read`) stays null */
  }
  return { ok: code === 0, json, errCode: json?.error?.code ?? '' };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (msg: string) =>
  console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);

function int(v: string | undefined, fallback: number): number {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ------------------------------------------------------------- herdr wrappers

/**
 * `agent prompt --wait` is atomic submit-and-wait: it matches the first state
 * observed AFTER submission. Plain `agent wait` cannot open the watch — measured
 * 2026-08-28, it returns in 0ms with the STALE pre-prompt `idle`, which would mark
 * every child settled-with-no-draft the instant it launched.
 */
function promptAndWait(name: string, text: string) {
  return herdr([
    'agent',
    'prompt',
    name,
    text,
    '--wait',
    '--timeout',
    String(SETTLE_TIMEOUT_MS),
  ]);
}

/**
 * Every wait is bounded. This process does not own the herdr process it is blocked
 * on, so an unbounded wait would outlive the driver as an orphan; on timeout the
 * caller re-classifies, which is self-healing.
 */
function waitSettled(name: string) {
  return herdr(['agent', 'wait', name, '--timeout', String(SETTLE_TIMEOUT_MS)]);
}

/** Only ever waits for a state genuinely still in the future — see SKILL.md. */
function waitWorking(name: string) {
  return herdr([
    'agent',
    'wait',
    name,
    '--until',
    'working',
    '--timeout',
    String(RESUME_TIMEOUT_MS),
  ]);
}

/**
 * A usage limit makes Claude Code SETTLE while it waits to continue, which is
 * indistinguishable from a dead child by lifecycle state alone. Observed twice on
 * 2026-08-28: seven children were reported failed, and several finished on their own
 * afterwards. The banner is the only thing that separates the two.
 */
const CAPACITY_BANNER =
  /usage limit reached|hit your usage limit|continuing automatically at|low-priority to continue|session limit|quota exceeded/i;

/** Set by the first throttled child; stops the queue feeding an account-wide limit. */
let capacityHold = false;

async function paneLooksThrottled(name: string): Promise<boolean> {
  const { stdout, stderr } = await run('herdr', [
    'agent',
    'read',
    name,
    '--source',
    'visible',
    '--lines',
    '40',
  ]);
  return CAPACITY_BANNER.test(stdout || stderr || '');
}

async function agentStatus(name: string): Promise<string> {
  const { json } = await herdr(['agent', 'get', name]);
  return json?.result?.agent?.agent_status ?? 'gone';
}

/**
 * herdr types into the composer as soon as the pane exists, but `--wait` needs an
 * observed state change within a FIXED 5s of submitting from a non-working state —
 * `--timeout` governs the settle wait after that floor, and cannot extend it. A cold
 * Claude Code boot routinely misses 5s, so wait for the TUI to report itself
 * interactive instead of racing it (measured 2026-08-31: all 3 children stalled at
 * exactly 5s, then submitted fine a moment later).
 */
async function waitInteractive(
  name: string,
  timeoutMs = 120000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { json } = await herdr(['agent', 'get', name]);
    if (json?.result?.agent?.interactive_ready) return true;
    if (Date.now() > deadline) return false;
    await sleep(1000);
  }
}

// ------------------------------------------------------------------- drafts

function frontmatter(file: string, key: string): string | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  for (const line of lines.slice(1)) {
    if (line === '---') break;
    const i = line.indexOf(':');
    if (i < 0) continue;
    if (line.slice(0, i).trim() !== key) continue;
    return line
      .slice(i + 1)
      .trim()
      .replace(/^"|"$/g, '');
  }
  return null;
}

const draftPath = (pr: number) => path.join(TRIAGE_DIR, `${pr}.md`);

/**
 * Pre-flight skip test, mirroring review-pr's own Step 2 dedup — including that a
 * draft with no `pipeline_version` came from a weaker pipeline and must be redone.
 */
function alreadyReviewed(
  pr: number,
  headSha: string,
  pipelineVersion: string
): string | null {
  const f = draftPath(pr);
  if (frontmatter(f, 'head_sha') !== headSha) return null;
  if (frontmatter(f, 'pipeline_version') !== pipelineVersion) return null;
  return frontmatter(f, 'verdict') || null;
}

/**
 * Slot-release test. Keyed on mtime, not head_sha: if the author pushes between our
 * triage read and the child's own Step 2, the child reviews (correctly) a head we
 * never saw, and a sha comparison would hold the slot forever.
 */
function freshDraftVerdict(pr: number, sinceEpochSec: number): string | null {
  const f = draftPath(pr);
  let mtime: number;
  try {
    mtime = fs.statSync(f).mtimeMs / 1000;
  } catch {
    return null;
  }
  if (mtime < sinceEpochSec) return null;
  return frontmatter(f, 'verdict') || null;
}

// --------------------------------------------------------------------- disk

/**
 * Free KB on whatever filesystem backs the container store. On this Mac docker is a
 * Lima VM, so the host's df is the wrong number by ~150GB.
 */
async function dockerFreeKb(): Promise<number | null> {
  const ctx = await run('docker', [
    'context',
    'inspect',
    '--format',
    '{{.Endpoints.docker.Host}}',
  ]);
  if (ctx.code !== 0) return null;
  const endpoint = ctx.stdout.trim();
  const lima = /\/\.lima\/([^/]+)\//.exec(endpoint);
  const out = lima
    ? await run('limactl', ['shell', lima[1], 'df', '-Pk', '/var/lib/docker'])
    : await run('df', ['-Pk', '/']);
  if (out.code !== 0) return null;
  const last = out.stdout.trim().split('\n').pop() ?? '';
  const avail = Number(last.split(/\s+/)[3]);
  return Number.isFinite(avail) ? avail : null;
}

// -------------------------------------------------------------------- board

const REVIEW_CLI = path.join(REPO, '.claude/tools/review');

/** Fire-and-forget: a record write must never fail a batch that is otherwise fine. */
function reviewCli(args: string[]) {
  const r = spawnSync(REVIEW_CLI, args, { encoding: 'utf-8' });
  if (r.status !== 0 && r.stderr) log(`review cli: ${r.stderr.trim()}`);
}

/**
 * In-memory scheduler view. The DURABLE copy is the per-PR record the `review`
 * CLI owns, so `review watch` sees every transition and one monitor covers every
 * batch. There is no batch file: a batch is a launch grouping, not a thing to
 * reconcile against, and having two stores is what made "did this die or has it
 * not started" ambiguous.
 */
class Board {
  readonly prs: Pr[] = [];

  constructor(readonly batchId: string) {}

  count(...states: PrState[]) {
    return this.prs.filter((p) => states.includes(p.state)).length;
  }

  /** Children actually occupying a sandbox right now, parked ones included. */
  sandboxCount() {
    return this.count('running', 'needs-input', 'awaiting-grill');
  }

  set(pr: Pr, state: PrState, note = '') {
    pr.state = state;
    pr.note = note;
    // 'skipped' is a scheduling outcome, not a review lifecycle state — a PR the
    // driver never launched has no record to move, and stamping one would invent
    // a review that did not happen.
    if (state === 'skipped') return;
    reviewCli([
      'set',
      String(pr.number),
      state,
      ...(note ? ['--note', note] : []),
    ]);
  }

  /** Create records for everything about to be scheduled, so `watch` sees them queued. */
  stageAll() {
    for (const pr of this.prs) {
      if (pr.state === 'skipped') continue;
      reviewCli([
        'stage',
        String(pr.number),
        '--title',
        pr.title,
        '--head',
        pr.headSha ?? '',
      ]);
    }
  }
}

// ------------------------------------------------------------------- launch

async function launch(pr: Pr): Promise<boolean> {
  const name = `pr-${pr.number}`;
  const existing = await herdr(['agent', 'get', name]);
  if (existing.ok) {
    pr.note = `agent ${name} already live — close that tab first`;
    return false;
  }

  const created = await herdr([
    'tab',
    'create',
    '--workspace',
    process.env.HERDR_WORKSPACE_ID!,
    '--cwd',
    REPO,
    '--label',
    name,
    '--no-focus',
    ...(NONINTERACTIVE ? ['--env', 'REVIEW_NONINTERACTIVE=1'] : []),
  ]);
  const pane: string | undefined = created.json?.result?.root_pane?.pane_id;
  if (!pane) {
    pr.note = `tab create failed: ${created.errCode || 'unknown'}`;
    return false;
  }
  pr.pane = pane;
  pr.tab = created.json?.result?.tab?.tab_id;

  // A freshly created pane is not always at its shell prompt on the first ask.
  for (let attempt = 1; ; attempt++) {
    const started = await herdr([
      'agent',
      'start',
      name,
      '--kind',
      'claude',
      '--pane',
      pane,
      '--timeout',
      '120000',
    ]);
    if (started.ok) break;
    if (attempt >= 3) {
      pr.note = `agent start failed in ${pane} after ${attempt} tries`;
      return false;
    }
    await sleep(3000);
  }

  pr.startedAt = Date.now() / 1000;
  // Record where this child lives while it is still running: `review resume`
  // focuses it if the pid is alive and otherwise reopens the session by id, and
  // neither is recoverable once the tab is gone.
  reviewCli(['link', String(pr.number), '--from-agent', name]);
  return true;
}

/**
 * Milliseconds still owed before a terminal-looking status may be believed. Zero once
 * the child has been seen working, or once the floor has elapsed. The deadline is
 * absolute, so this can never re-arm and a flapping status cannot loop.
 */
export function startupGrace(
  pr: Pick<Pr, 'startedAt' | 'sawWorking'>,
  now = Date.now(),
  minRunSecs = MIN_RUN_SECS
): number {
  if (pr.sawWorking) return 0;
  return Math.max(0, (pr.startedAt + minRunSecs) * 1000 - now);
}

/** `gone` is only fatal if it survives the startup floor. */
async function confirmedGone(pr: Pr, name: string): Promise<boolean> {
  if ((await agentStatus(name)) !== 'gone') return false;
  const grace = startupGrace(pr);
  if (grace === 0) return true;
  await sleep(grace);
  return (await agentStatus(name)) === 'gone';
}

/** Resolves the moment the child parks at the grill, or gives up on it. */
async function watch(pr: Pr, board: Board): Promise<Outcome> {
  const name = `pr-${pr.number}`;

  await waitInteractive(name);

  const submitted = await promptAndWait(name, pr.prompt);
  if (['agent_not_found', 'invalid_target'].includes(submitted.errCode)) {
    return {
      kind: 'failed',
      note: `could not submit the review prompt (${submitted.errCode})`,
    };
  }
  // `agent_prompt_stalled` says herdr could not CONFIRM the submission, not that the
  // text never went. Believe the agent over the confirmation: only a vanished one has
  // really failed, and everything else is settled by the draft watch below.
  if (
    submitted.errCode === 'agent_prompt_stalled' &&
    (await confirmedGone(pr, name))
  ) {
    return {
      kind: 'failed',
      note: 'agent vanished before the review prompt landed',
    };
  }

  for (;;) {
    const verdict = freshDraftVerdict(pr.number, pr.startedAt);
    if (verdict) return { kind: 'parked', verdict };

    const status = await agentStatus(name);
    if (status === 'working') pr.sawWorking = true;
    switch (status) {
      case 'blocked': {
        // No draft, so this is a permission dialog and not the grill. Keep the slot:
        // the review has not happened yet.
        const age = Math.round(Date.now() / 1000 - pr.startedAt);
        board.set(pr, 'needs-input', 'asking permission — slot held');
        log(
          `#${pr.number} NEEDS INPUT ${age}s in — no draft, so this is a permission prompt and not the grill: herdr agent focus ${name}`
        );
        await waitWorking(name);
        pr.sawWorking = true;
        board.set(pr, 'running', 'resumed after approval');
        await waitSettled(name);
        break;
      }
      case 'idle':
      case 'done':
      case 'gone': {
        // A child that has not reached `working` yet reads exactly like one that died,
        // so hold the verdict until the floor clears rather than writing it off.
        const grace = startupGrace(pr);
        if (grace > 0) {
          board.set(pr, 'running', `${status} during startup — re-checking`);
          await sleep(grace);
          break;
        }
        // Settled with no draft is usually death, but a usage limit looks identical.
        // Check before writing the child off: it keeps its slot, and the queue stops,
        // because the limit is account-wide and the next child would hit it too.
        if (status !== 'gone' && (await paneLooksThrottled(name))) {
          capacityHold = true;
          board.set(
            pr,
            'throttled',
            'usage limit, waiting for the account to resume'
          );
          log(
            `#${pr.number} THROTTLED by a usage limit — holding its slot, not launching more`
          );
          await waitWorking(name);
          pr.sawWorking = true;
          capacityHold = false;
          board.set(pr, 'running', 'resumed after usage limit');
          log(`#${pr.number} resumed`);
          await waitSettled(name);
          break;
        }
        return {
          kind: 'failed',
          note: 'settled with no draft (crash, session limit, or early exit)',
        };
      }
      default:
        await waitSettled(name);
    }
  }
}

/**
 * What the NEXT sandbox will cost, from what the live ones actually consumed.
 *
 * The batch's spend is not linear in the number of reviews: the first review in a
 * cold container copies the pnpm store out of the read-only image layer (~2.3 GB,
 * once), and every review after it hardlinks into what is already there. So
 * dividing total-used by live count charges the next review a share of a fixed
 * cost that has already been paid, over-projects by roughly an order of magnitude,
 * and refuses launches there is ample room for.
 *
 * Measuring the DELTA between two consecutive observations sidesteps the modelling
 * entirely — no constant to keep in step with the image. `prev` is only usable when
 * the live count actually grew between them; a release moves free space the other
 * way and would otherwise read as a negative cost.
 *
 * Exported for the unit test; `sample` carries the state so this stays pure.
 */
export function projectSandboxCostKb(
  prev: { freeKb: number; live: number } | null,
  now: { freeKb: number; live: number },
  seedKb: number
): number {
  if (!prev || now.live <= prev.live) return seedKb;
  const usedKb = prev.freeKb - now.freeKb;
  if (usedKb <= 0) return seedKb;
  return Math.floor(usedKb / (now.live - prev.live));
}

let diskSample: { freeKb: number; live: number } | null = null;

/**
 * "Pause only if expecting disk exhaustion": refuse to start a sandbox that would
 * eat into the reserve. Every parked child still pins its sandbox — review-pr keeps
 * it alive THROUGH the grill so Step 8.5 can read `--ref base`.
 */
async function diskHeadroom(board: Board, startFreeKb: number | null) {
  const freeKb = await dockerFreeKb();
  if (freeKb == null) return { ok: true, msg: '' };

  const now = { freeKb, live: board.sandboxCount() };
  const costKb = projectSandboxCostKb(
    diskSample ??
      (startFreeKb == null ? null : { freeKb: startFreeKb, live: 0 }),
    now,
    SEED_SANDBOX_GB * 1024 * 1024
  );
  diskSample = now;

  const gb = (kb: number) => Math.round(kb / 1024 / 1024);
  return {
    ok: freeKb - costKb >= DISK_RESERVE_GB * 1024 * 1024,
    msg: `container store has ${gb(freeKb)}GB free; next sandbox ~${gb(costKb)}GB; reserve ${DISK_RESERVE_GB}GB`,
  };
}

// --------------------------------------------------------------------- main

async function reviewOne(
  pr: Pr,
  pool: SlotPool,
  board: Board,
  startFreeKb: number | null
) {
  const slot = await pool.acquire();
  try {
    // Do not open a new session while the account is throttled: it would settle
    // immediately, and at batch scale that burns the whole queue in minutes.
    while (capacityHold) {
      log(`#${pr.number} waiting: another child is throttled by a usage limit`);
      await sleep(TICK_MS);
    }

    for (;;) {
      const disk = await diskHeadroom(board, startFreeKb);
      if (disk.ok) break;
      if (board.count('running', 'needs-input') === 0) {
        board.set(pr, 'skipped', `no disk headroom — ${disk.msg}`);
        log(
          `#${pr.number} skipped: no disk headroom and nothing running to free it.`
        );
        return;
      }
      log(
        `holding #${pr.number}: ${disk.msg}. Grill and close a parked tab to free one.`
      );
      await sleep(TICK_MS);
    }

    if (!(await launch(pr))) {
      board.set(pr, 'failed', pr.note);
      log(`#${pr.number} FAILED — ${pr.note}`);
      return;
    }
    board.set(pr, 'running');
    log(`launched #${pr.number} in ${pr.tab} (${pr.pane}) — ${pr.title}`);

    const outcome = await watch(pr, board);
    if (outcome.kind === 'parked') {
      board.set(pr, 'awaiting-grill', outcome.verdict);
      log(
        `#${pr.number} done → ${outcome.verdict} — slot freed, parked for your grill (herdr agent focus pr-${pr.number})`
      );
    } else {
      board.set(pr, 'failed', outcome.note);
      log(`#${pr.number} FAILED — ${outcome.note}`);
    }
  } finally {
    // The only release. `awaiting-grill` is terminal because this function has
    // returned — nothing is left watching that could reclaim the slot when the
    // child goes back to `working` to answer the grill.
    slot.release();
  }
}

export function parsePrs(argv: string[]): number[] {
  const out: number[] = [];
  for (const raw of argv) {
    for (const tok of raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)) {
      const nx = /^https:\/\/github\.com\/nrwl\/nx\/pull\/(\d+)/.exec(tok);
      const foreign = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\//.exec(
        tok
      );
      if (!nx && foreign) {
        throw new Error(
          `not an nrwl/nx PR: ${tok} (review-pr only reviews nrwl/nx)`
        );
      }
      const n = nx ? Number(nx[1]) : Number(tok.replace(/^#/, ''));
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`cannot read a PR number from: ${tok}`);
      }
      if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  // review-pr exits early on a draft PR at its own Step 2, so opening drafts in takes
  // more than skipping our triage check: the child has to be told the author asked.
  const includeDrafts = argv.includes('--include-drafts');
  const rest = argv.filter(
    (a) => a !== '--dry-run' && a !== '--include-drafts'
  );

  if (process.env.HERDR_ENV !== '1') {
    throw new Error(
      'not running inside herdr (HERDR_ENV != 1). This driver creates herdr tabs; run it from a herdr pane.'
    );
  }
  if (!process.env.HERDR_WORKSPACE_ID)
    throw new Error('HERDR_WORKSPACE_ID unset');
  if (!fs.existsSync(path.join(REPO, '.claude/skills/review-pr'))) {
    throw new Error(`no review-pr skill under ${REPO} (set NX_REPO_PATH)`);
  }

  const numbers = parsePrs(rest);
  if (!numbers.length)
    throw new Error(
      'no PRs given. usage: review-many-prs.ts <pr-url|#N|N> ...'
    );

  // review-pr owns this constant; read it there so the two can never drift.
  const skill = fs.readFileSync(
    path.join(REPO, '.claude/skills/review-pr/SKILL.md'),
    'utf-8'
  );
  const pipelineVersion = /PIPELINE_VERSION: (\d+)/.exec(skill)?.[1];
  if (!pipelineVersion)
    throw new Error('could not read PIPELINE_VERSION from review-pr/SKILL.md');

  fs.mkdirSync(TRIAGE_DIR, { recursive: true });
  const now = new Date();
  const stamp = (n: number) => String(n).padStart(2, '0');
  // Local time, to match the log timestamps — a UTC batch id next to local logs
  // reads as a different run.
  const board = new Board(
    `${now.getFullYear()}${stamp(now.getMonth() + 1)}${stamp(now.getDate())}-` +
      `${stamp(now.getHours())}${stamp(now.getMinutes())}${stamp(now.getSeconds())}`
  );

  log(
    "pre-flight (once, on the host — so the first children don't each wait on a cold image)"
  );
  if ((await run('gh', ['auth', 'status'])).code !== 0)
    throw new Error('gh is not authenticated');
  const doctor = await run(path.join(REPO, '.claude/tools/sandbox'), [
    'doctor',
  ]);
  if (doctor.code !== 0) {
    throw new Error(
      'sandbox doctor found no usable backend — see the setup-review-sandbox skill'
    );
  }
  if (!dryRun) {
    const build = await run('bash', [
      path.join(REPO, 'tools/review-sandbox/build-image.sh'),
    ]);
    if (build.code !== 0)
      throw new Error(`sandbox image build failed:\n${build.stderr}`);
  }

  log('triage: resolving heads and skipping what is already reviewed');
  for (const number of numbers) {
    const pr: Pr = {
      number,
      title: '',
      headSha: '',
      state: 'queued',
      note: '',
      startedAt: 0,
      prompt: `/review-pr ${number}`,
    };
    board.prs.push(pr);

    const view = await run('gh', [
      'pr',
      'view',
      String(number),
      '--repo',
      'nrwl/nx',
      '--json',
      'number,title,headRefOid,isDraft,state',
    ]);
    if (view.code !== 0) {
      pr.state = 'skipped';
      pr.note = 'gh pr view failed';
    } else {
      const meta = JSON.parse(view.stdout);
      pr.title = meta.title;
      pr.headSha = meta.headRefOid;
      const seen = alreadyReviewed(number, pr.headSha, pipelineVersion);
      if (meta.isDraft && !includeDrafts) {
        pr.state = 'skipped';
        pr.note = 'draft PR';
      } else if (meta.isDraft) {
        // Named exception, not a silent bypass: the child is told who authorised it and
        // which single check to skip, and nothing else about the skill changes.
        pr.note = 'draft, explicitly included';
        pr.prompt =
          `Run the review-pr skill for PR ${number} in nrwl/nx. The author has explicitly ` +
          `asked for this review even though the PR is still a draft, so do not exit early ` +
          `at Step 2's isDraft check. Every other part of the skill applies unchanged.`;
      } else if (meta.state !== 'OPEN') {
        pr.state = 'skipped';
        pr.note = meta.state;
      } else if (seen && seen !== 'failed') {
        pr.state = 'skipped';
        pr.note = `already reviewed at this head (${seen})`;
      }
    }
    console.log(
      `  #${String(number).padEnd(6)} ${pr.state.padEnd(13)} ${pr.note.padEnd(26)} ${pr.title}`
    );
  }
  board.stageAll();

  if (dryRun) {
    log('dry run — nothing launched, and no records staged.');
    return;
  }

  const startFreeKb = await dockerFreeKb();
  const pool = new SlotPool(CONCURRENCY);
  log(
    `scheduling ${board.prs.length} PRs, ${CONCURRENCY} at a time. records: .claude/tools/review list`
  );

  // Ticks cover only what herdr cannot signal: a child wedged on secreq's
  // out-of-band gh consent reads as `working` forever and emits no lifecycle event.
  const ticker = setInterval(() => {
    const live = board.prs
      .filter((p) => p.state === 'running' || p.state === 'needs-input')
      .map(
        (p) =>
          `#${p.number}:${p.state === 'needs-input' ? 'NEEDS-INPUT' : 'run'}`
      );
    if (live.length) {
      log(
        `slots ${live.join(' ')} | queued=${board.count('queued')} parked=${board.count('awaiting-grill')}`
      );
    }
  }, TICK_MS);
  ticker.unref();

  const queued = board.prs.filter((p) => p.state === 'queued');
  await Promise.all(
    queued.map((pr) => reviewOne(pr, pool, board, startFreeKb))
  );
  clearInterval(ticker);

  console.log(`\n===== review-many-prs: batch ${board.batchId} =====`);
  for (const p of board.prs) {
    console.log(
      `  #${String(p.number).padEnd(6)} ${p.state.padEnd(14)} ${p.note.padEnd(34)} ${p.title}`
    );
  }
  console.log(`\nrecords:     .claude/tools/review list`);
  console.log(`drafts:      ${TRIAGE_DIR}/<PR>.md`);
  console.log(`jump to one: herdr agent focus pr-<PR>`);
  console.log(`post them:   /review-pending-pr-reviews\n`);

  const held = board.sandboxCount();
  if (PRUNE_AT_END && held === 0) {
    log('no parked children left — pruning leaked sandboxes');
    await run(path.join(REPO, '.claude/tools/sandbox'), ['prune']);
  } else {
    log(
      `skipping prune: ${held} child(ren) still hold a live sandbox for their grill`
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`review-many-prs: ${err.message}`);
    process.exit(1);
  });
}
