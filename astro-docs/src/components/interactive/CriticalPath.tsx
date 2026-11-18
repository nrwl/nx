// #1 Critical-path scheduling, in three beats:
//   1. Score: every task gets its path weight, its own time plus the longest
//      chain still waiting behind it (Nx Cloud: pathWeight = dur + max over
//      dependents). Scores fill in from the end of the chain backwards.
//   2. Queue: ready tasks line up by score. Blocked chain tasks wait below.
//   3. Run: workers always take the top of the queue. When a build finishes,
//      the next one enters with its score and goes straight to the top.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import {
  BASE,
  CAPTION,
  Frame,
  Gantt,
  INSTANT,
  Legend,
  ReplayButton,
  SWAP_OUT,
  Steps,
  type Playback,
  type Tokens,
  usePlayhead,
  hoverOrTap,
  useC,
} from './kit';
import { remainingChain, simulate, type SimBar, type SimTask } from './sim';

const STEPS: { id: Phase; label: string }[] = [
  { id: 'score', label: 'Score' },
  { id: 'queue', label: 'Queue' },
  { id: 'run', label: 'Run' },
];

const CHAIN_IDS = ['shared:build', 'ui:build', 'web:build', 'web-e2e:e2e'];

// Graph order, used to break ties between equal scores.
const TASKS: SimTask[] = [
  { id: 'ui:lint', label: 'ui:lint', dur: 2 },
  { id: 'api:test', label: 'api:test', dur: 4 },
  { id: 'ui:test', label: 'ui:test', dur: 3 },
  { id: 'auth:test', label: 'auth:test', dur: 3 },
  { id: 'api:lint', label: 'api:lint', dur: 2 },
  { id: 'utils:test', label: 'utils:test', dur: 2 },
  { id: 'web:lint', label: 'web:lint', dur: 2 },
  { id: 'auth:lint', label: 'auth:lint', dur: 1 },
  { id: 'web:typecheck', label: 'web:typecheck', dur: 3 },
  { id: 'shared:build', label: 'shared:build', dur: 3, kind: 'chain' },
  {
    id: 'ui:build',
    label: 'ui:build',
    dur: 2,
    deps: ['shared:build'],
    kind: 'chain',
  },
  {
    id: 'web:build',
    label: 'web:build',
    dur: 3,
    deps: ['ui:build'],
    kind: 'chain',
  },
  {
    id: 'web-e2e:e2e',
    label: 'web-e2e:e2e',
    dur: 6,
    deps: ['web:build'],
    kind: 'chain',
  },
];
const BY_ID = new Map(TASKS.map((t) => [t.id, t]));
const ORDER = new Map(TASKS.map((t, i) => [t.id, i]));
const INDEPENDENT = TASKS.filter((t) => t.kind !== 'chain');
const SCORE = remainingChain(TASKS);
const FLOOR = Math.max(...SCORE.values());
const SCALE = 16;
const RUN_SECONDS = 8;
/** Schedule minutes a taken task lingers on top of the queue (~0.4s). */
const TAKE = 0.8;

// Beat timing (seconds). The chain scores land right to left (cause and
// effect), the leaf scores land together as one beat, then each beat holds
// long enough to read before the next one starts.
const STEP = 0.7;
const chainDelay = (id: string) =>
  0.4 + (CHAIN_IDS.length - 1 - CHAIN_IDS.indexOf(id)) * STEP;
const LEAF_AT = 0.4 + CHAIN_IDS.length * STEP + 0.2;
const SCORE_MS = (LEAF_AT + 0.3 + 2.5) * 1000;
const QUEUE_MS = 2800;
/** Queue chips shown before "+n more", so the strip stays one line. */
const VISIBLE = 5;

type Phase = 'score' | 'queue' | 'run';

/** Re-render only when the clock crosses a schedule event, not every frame. */
function useScheduleTime(pb: Playback, bars: SimBar[]): number {
  const events = useMemo(
    () =>
      [...new Set(bars.flatMap((b) => [b.start, b.start + TAKE, b.end]))].sort(
        (a, b) => a - b
      ),
    [bars]
  );
  const [now, setNow] = useState(0);
  const last = useRef(0);
  useMotionValueEvent(pb.clock, 'change', (v) => {
    let step = 0;
    for (const e of events) if (e <= v + 1e-6) step = e;
    if (step !== last.current) {
      last.current = step;
      setNow(step);
    }
  });
  return now;
}

// Dependency lookups for the hover highlight.
const DEPENDENTS = new Map<string, string[]>();
for (const t of TASKS)
  for (const d of t.deps ?? [])
    DEPENDENTS.set(d, [...(DEPENDENTS.get(d) ?? []), t.id]);

/** The task plus everything upstream and downstream of it. */
function relatedTo(id: string): Set<string> {
  const out = new Set([id]);
  const walk = (cur: string, next: (x: string) => string[]) => {
    for (const n of next(cur))
      if (!out.has(n)) {
        out.add(n);
        walk(n, next);
      }
  };
  walk(id, (x) => BY_ID.get(x)!.deps ?? []);
  walk(id, (x) => DEPENDENTS.get(x) ?? []);
  return out;
}

function explain(id: string): string {
  const t = BY_ID.get(id)!;
  const deps = t.deps ?? [];
  const next = DEPENDENTS.get(id) ?? [];
  const needs = deps.length ? `needs ${deps.join(', ')}` : 'needs nothing';
  const unlocks = next.length
    ? `unlocks ${next.join(', ')}`
    : 'unlocks nothing';
  const score = next.length
    ? `Score ${SCORE.get(id)} = ${t.dur}m + ${Math.max(...next.map((n) => SCORE.get(n)!))}.`
    : `Score ${SCORE.get(id)}: just its own ${t.dur}m.`;
  return `${id} ${needs} and ${unlocks}. ${score}`;
}

interface HoverState {
  hover: string | null;
  setHover: (id: string | null) => void;
  related: Set<string> | null;
}
const HoverCtx = createContext<HoverState>({
  hover: null,
  setHover: () => {},
  related: null,
});

// Agents pull the next task whenever they free up, so a task has no pull
// toward the worker that ran its dependency. When two workers are free at
// once, offer the other one first, so the figure shows the chain crossing
// workers instead of implying it is pinned to one.
const awayFromDependency = (
  _now: number,
  workers: number,
  task: SimTask,
  bars: SimBar[]
) => {
  const all = Array.from({ length: workers }, (_, i) => i);
  const dep = task.deps?.[0];
  const prev = bars.find((b) => b.task.id === dep)?.worker;
  return prev === undefined ? all : [...all.filter((w) => w !== prev), prev];
};

const byScore = (a: string, b: string) =>
  SCORE.get(b)! - SCORE.get(a)! || ORDER.get(a)! - ORDER.get(b)!;

export default function CriticalPath() {
  const C = useC();
  const [phase, setPhase] = useState<Phase>('score');
  const [hover, setHover] = useState<string | null>(null);
  const related = useMemo(() => (hover ? relatedTo(hover) : null), [hover]);
  const faded = (id: string) => !!related && !related.has(id);
  const [replays, setReplays] = useState(0);
  // Auto-advance until the reader picks a step; Replay turns it back on.
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  const result = useMemo(
    () =>
      simulate(TASKS, {
        workers: 3,
        capacity: 1,
        mode: 'slots',
        slots: 1,
        priority: 'critical',
        workerOrder: awayFromDependency,
      }),
    []
  );
  const byId = useMemo(
    () => new Map(result.bars.map((b) => [b.task.id, b])),
    [result]
  );

  // Score -> Queue -> Run.
  useEffect(() => {
    if (!inView || !auto) return;
    const scoreMs = SCORE_MS;
    setPhase('score');
    const t1 = setTimeout(() => setPhase('queue'), scoreMs);
    const t2 = setTimeout(() => setPhase('run'), scoreMs + QUEUE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [inView, replays, auto]);

  const pb = usePlayhead(
    result.makespan,
    replays,
    RUN_SECONDS,
    phase === 'run'
  );
  const clockNow = useScheduleTime(pb, result.bars);
  const now = phase === 'run' ? clockNow : -1;

  // Queue state at `now` (-1 = before the run starts: nothing taken yet).
  // A task stays on top of the queue for a beat after a worker takes it, so
  // you see it leave the queue as its bar starts.
  const started = (id: string) => now >= 0 && now >= byId.get(id)!.start + TAKE;
  const ready = (id: string) =>
    (BY_ID.get(id)!.deps ?? []).every((d) => now >= byId.get(d)!.end);
  const queued = TASKS.map((t) => t.id)
    .filter((id) => !started(id) && ready(id))
    .sort(byScore);
  const waiting = CHAIN_IDS.filter((id) => !started(id) && !ready(id));

  const finished = phase === 'run' && pb.done;

  return (
    <div ref={ref}>
      <div ref={pb.ref}>
        <Frame
          label="Critical-path scheduling"
          controls={
            <>
              <Steps
                steps={STEPS}
                phase={phase}
                onPick={(p) => {
                  setAuto(false);
                  setHover(null);
                  setPhase(p);
                }}
              />
              <ReplayButton
                onClick={() => {
                  setAuto(true);
                  setReplays((r) => r + 1);
                }}
              />
            </>
          }
          footer={
            <div className="flex flex-wrap items-end gap-4">
              <Legend
                items={[
                  { color: C.primary, label: 'build → e2e chain' },
                  { color: C.task, label: 'independent tasks' },
                  { color: C.dangerFill, label: 'idle worker' },
                ]}
              />
            </div>
          }
        >
          <HoverCtx.Provider value={{ hover, setHover, related }}>
            <LayoutGroup id={`cp-${replays}`}>
              <div className="min-h-[260px]">
                {phase === 'score' ? (
                  <ScoreView C={C} />
                ) : (
                  <div>
                    <Queue queued={queued} waiting={waiting} C={C} />
                    <div className="relative mt-5">
                      <Gantt
                        lanes={3}
                        rows={1}
                        rowHeight={28}
                        bars={result.bars}
                        pb={pb}
                        end={result.makespan}
                        scale={SCALE}
                        emptyRowFill={C.dangerWash}
                        color={(b) =>
                          faded(b.task.id)
                            ? C.ghost
                            : b.task.kind === 'chain'
                              ? C.primary
                              : C.task
                        }
                        textColor={(b) =>
                          faded(b.task.id)
                            ? C.muted
                            : b.task.kind === 'chain'
                              ? C.onFill
                              : C.taskText
                        }
                        barProps={(b) => hoverOrTap(b.task.id, hover, setHover)}
                      />
                      <FloorLine at={FLOOR} C={C} />
                    </div>
                  </div>
                )}
              </div>
            </LayoutGroup>
          </HoverCtx.Provider>

          {/* Fixed height: hover explanations and step captions differ in length,
              and the footer must not jump when they swap. */}
          <p className="mt-5 min-h-[4.875em] max-w-[65ch] text-sm leading-relaxed text-(--fig-fg2) sm:min-h-[3.25em]">
            {hover ? explain(hover) : caption(phase, finished)}
          </p>
        </Frame>
      </div>
    </div>
  );
}

function caption(phase: Phase, finished: boolean) {
  if (phase === 'score')
    return 'Each task is scored by the longest chain of work still waiting behind it: its own time plus the score of what it unlocks. shared:build scores 14, a lint scores 1.';
  if (phase === 'queue')
    return 'Ready tasks line up by score, highest first. The rest of the chain waits on shared:build.';
  return finished
    ? 'Every build starts the moment it is unblocked, so the run ends at the length of the chain. Short tasks fill the gaps around it.'
    : 'Workers always take the next task. Each finished build releases the one after it, and its score puts it straight to the front.';
}

/** Score → Queue → Run. Each step is a button: jump to it and stay there. */
/** One task: mono id, duration, and its score once it has one. */
function Chip({
  id,
  C,
  scoreDelay,
  showScore,
  dim = false,
  compact = false,
}: {
  id: string;
  C: Tokens;
  scoreDelay?: number;
  showScore: boolean;
  dim?: boolean;
  compact?: boolean;
}) {
  const task = BY_ID.get(id)!;
  const chain = task.kind === 'chain';
  const reduced = useReducedMotion();
  const { hover, setHover, related } = useContext(HoverCtx);
  const faded = !!related && !related.has(id);
  return (
    <motion.div
      {...hoverOrTap(id, hover, setHover)}
      animate={{ opacity: faded ? 0.3 : dim ? 0.65 : 1 }}
      layoutId={`task-${id}`}
      // Brand movement: critically damped spring, no overshoot. Reduced
      // motion jumps between the beats instead of travelling.
      transition={{
        layout: reduced
          ? { duration: 0 }
          : { type: 'spring', duration: 0.8, bounce: 0 },
        opacity: INSTANT,
      }}
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-(--fig-surface) px-2.5 ${
        compact ? 'h-7 shrink-0' : 'py-1.5'
      }`}
      style={{
        borderColor: chain ? C.primary : C.border,
        borderStyle: dim ? 'dashed' : 'solid',
        boxShadow: hover === id ? `0 0 0 3px ${C.primaryWash}` : 'none',
      }}
    >
      <span className="min-w-0 truncate font-['Server_Mono',ui-monospace,monospace] text-xs text-(--fig-fg)">
        {id}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {!compact && (
          <span className="text-xs text-(--fig-muted) tabular-nums">
            {task.dur}m
          </span>
        )}
        {showScore && (
          <motion.span
            initial={scoreDelay === undefined ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...BASE, delay: scoreDelay ?? 0 }}
            className="min-w-7 rounded-md px-1.5 text-center text-xs font-semibold tabular-nums"
            style={{
              background: chain ? C.primary : C.mutedBg,
              color: chain ? C.onFill : C.fg2,
            }}
          >
            {SCORE.get(id)}
          </motion.span>
        )}
      </span>
    </motion.div>
  );
}

/** Beat 1: the task graph, scored from the end of the chain backwards. */
function ScoreView({ C }: { C: Tokens }) {
  return (
    <div>
      <div className={`${CAPTION} mb-2 text-(--fig-muted)`}>
        Build chain · each task needs the one before
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:flex sm:items-center sm:gap-0">
        {CHAIN_IDS.map((id, i) => (
          <div key={id} className="flex min-w-0 items-start sm:flex-1">
            {i > 0 && (
              // "needs the one before": the arrow points the way work flows,
              // from a build to the task it unlocks.
              <svg
                aria-hidden
                viewBox="0 0 28 12"
                className="mx-1 mt-[11px] hidden h-3 w-7 shrink-0 sm:block"
                fill="none"
                stroke={C.primary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 6h24M20 1.5 25.5 6 20 10.5" />
              </svg>
            )}
            <div className="min-w-0 flex-1">
              <Chip id={id} C={C} showScore scoreDelay={chainDelay(id)} />
              {
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...INSTANT, delay: chainDelay(id) }}
                  className="mt-1 text-center text-[11px] text-(--fig-muted) tabular-nums"
                >
                  {i === CHAIN_IDS.length - 1
                    ? `${BY_ID.get(id)!.dur}m`
                    : `${BY_ID.get(id)!.dur}m + ${SCORE.get(CHAIN_IDS[i + 1])} from ${CHAIN_IDS[i + 1]}`}
                </motion.div>
              }
            </div>
          </div>
        ))}
      </div>

      <div className={`${CAPTION} mt-5 mb-2 text-(--fig-muted)`}>
        Independent · nothing waits on them
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {INDEPENDENT.map((t) => (
          <Chip key={t.id} id={t.id} C={C} showScore scoreDelay={LEAF_AT} />
        ))}
      </div>
    </div>
  );
}

/** Beats 2 and 3: the ready queue as one strip (next on the left), and the
 * chain tasks still waiting on a dependency. */
function Queue({
  queued,
  waiting,
  C,
}: {
  queued: string[];
  waiting: string[];
  C: Tokens;
}) {
  const reduced = useReducedMotion();
  const shown = queued.slice(0, VISIBLE);
  const more = queued.length - shown.length;
  const label = `${CAPTION} w-20 shrink-0 text-(--fig-muted)`;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className={label}>Ready</div>
        <ol className="flex h-7 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {shown.map((id, i) => (
              <motion.li
                key={id}
                className="flex shrink-0 items-center gap-1.5"
                exit={{
                  opacity: 0,
                  y: reduced ? 0 : 8,
                  filter: 'blur(6px)',
                  transition: SWAP_OUT,
                }}
              >
                {i === 0 && (
                  <span className="text-[11px] font-medium text-(--fig-primary-text)">
                    next
                  </span>
                )}
                <Chip id={id} C={C} compact showScore />
              </motion.li>
            ))}
          </AnimatePresence>
          {more > 0 && (
            <li className="shrink-0 text-xs text-(--fig-muted) tabular-nums">
              +{more} more
            </li>
          )}
          {queued.length === 0 && (
            <li className="text-xs text-(--fig-muted)">empty</li>
          )}
        </ol>
      </div>
      <div className="flex items-center gap-3">
        <div className={label}>Waiting</div>
        <ol className="flex h-7 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {waiting.map((id) => (
            <li key={id} className="shrink-0">
              <Chip id={id} C={C} compact dim showScore />
            </li>
          ))}
          {waiting.length === 0 && (
            <li className="text-xs text-(--fig-muted)">nothing blocked</li>
          )}
        </ol>
      </div>
    </div>
  );
}

/** Dashed marker at the chain length: no schedule can finish before it. */
function FloorLine({ at, C }: { at: number; C: Tokens }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 left-[4.75rem]">
      <div
        className="absolute -top-5 bottom-5 border-l border-dashed"
        style={{ left: `${(at / SCALE) * 100}%`, borderColor: C.primary }}
      >
        <span
          className="absolute -top-1 left-1.5 text-[11px] font-medium whitespace-nowrap"
          style={{ color: C.primaryText }}
        >
          longest chain {at}m
        </span>
      </div>
    </div>
  );
}
