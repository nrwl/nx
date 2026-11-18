// #5 Atomization, as a progression:
//   1. One e2e task: after shop:build, shop-e2e:e2e is one 18-minute task.
//      It pins one worker while the others finish and wait.
//   2. Atomize: Nx splits it into one task per spec file. The pieces slide
//      out across the workers.
//   3. Next PR: one file changes. Ultracache knows which tasks read it:
//      shop:build, shop:lint and, of the specs, only cart.spec.ts. Those
//      rerun; every other task turns cached and moves out of the lanes into
//      a cache bin, so the reruns fit on fewer workers.
import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';
import {
  BASE,
  Frame,
  Legend,
  MONO,
  ReplayButton,
  SWAP_IN,
  SWAP_OUT,
  Steps,
  useC,
} from './kit';
import { simulate, type SimTask } from './sim';

type Phase = 'single' | 'atomized' | 'cached';
const STEPS: { id: Phase; label: string }[] = [
  { id: 'single', label: 'One e2e task' },
  { id: 'atomized', label: 'Atomize' },
  { id: 'cached', label: 'Next PR' },
];

const SPECS: [string, number][] = [
  ['checkout', 4],
  ['cart', 3],
  ['search', 3],
  ['auth', 2],
  ['profile', 3],
  ['orders', 3],
];
const OTHER: SimTask[] = [
  { id: 'shop:build', label: 'shop:build', dur: 3, kind: 'other' },
  { id: 'shop:lint', label: 'shop:lint', dur: 2.5, kind: 'other' },
  { id: 'shop:test', label: 'shop:test', dur: 3, kind: 'other' },
  { id: 'ui:test', label: 'ui:test', dur: 2, kind: 'other' },
  { id: 'api:test', label: 'api:test', dur: 3, kind: 'other' },
];
/** The e2e tests run against the built app. */
const E2E_DEPS = ['shop:build'];
const E2E_TOTAL = SPECS.reduce((s, [, d]) => s + d, 0);
/** The spec that read the changed file. */
const CHANGED_SPEC = 'cart';
/** Every task that read the changed file reruns on the next PR. */
const RERUN = new Set([CHANGED_SPEC, 'shop:build', 'shop:lint']);
const WORKERS = 3;

interface Slot {
  worker: number;
  start: number;
  dur: number;
}
const sim = (tasks: SimTask[]) =>
  simulate(tasks, {
    workers: WORKERS,
    capacity: 1,
    mode: 'slots',
    slots: 1,
    priority: 'critical',
  });
const slots = (r: ReturnType<typeof sim>) =>
  new Map<string, Slot>(
    r.bars.map((b) => [
      b.task.id,
      { worker: b.worker, start: b.start, dur: b.task.dur },
    ])
  );
const SPEC_TASKS: SimTask[] = SPECS.map(([name, dur]) => ({
  id: name,
  label: name,
  dur,
  kind: 'e2e',
  deps: E2E_DEPS,
}));

// One e2e task: the specs run back to back inside it, on one worker.
const SINGLE = sim([
  {
    id: 'e2e',
    label: 'shop-e2e:e2e',
    dur: E2E_TOTAL,
    kind: 'e2e',
    deps: E2E_DEPS,
  },
  ...OTHER,
]);
const SLOTS_SINGLE = slots(SINGLE);
{
  const e2e = SLOTS_SINGLE.get('e2e')!;
  let at = e2e.start;
  for (const [name, dur] of SPECS) {
    SLOTS_SINGLE.set(name, { worker: e2e.worker, start: at, dur });
    at += dur;
  }
}
// Atomized: one task per spec, scheduled like any other task.
const SLOTS_ATOM = slots(sim([...SPEC_TASKS, ...OTHER]));
// Next PR: only the reruns are scheduled, from the start of the run.
const NEXT_PR = sim([...SPEC_TASKS, ...OTHER].filter((t) => RERUN.has(t.id)));
const SLOTS_NEXT = slots(NEXT_PR);
const NEXT_USED = new Set(NEXT_PR.bars.map((b) => b.worker));

const IDS = [...SPECS.map(([n]) => n), ...OTHER.map((u) => u.id)];
const CACHED_IDS = IDS.filter((id) => !RERUN.has(id));
const isSpec = (id: string) => SPECS.some(([n]) => n === id);
const specName = (id: string) => (isSpec(id) ? `${id}.spec.ts` : id);

const SCALE = SINGLE.makespan * 1.04;
const TICKS = [0, 5, 10, 15, 20].filter((m) => m < SCALE);
const pct = (m: number) => `${(Math.min(m, SCALE) / SCALE) * 100}%`;
const LANE_H = 36;
const LANE_GAP = 6;
const BAR_H = 26;
const laneTop = (w: number) => w * (LANE_H + LANE_GAP);
const MOVE = { duration: 0.8, ease: [0.32, 0.72, 0, 1] as const };
const AXIS_Y = laneTop(WORKERS) - LANE_GAP + 6;
const LANES_H = AXIS_Y + 18;
/** The cache bin under the lanes: cache hits take no time on a worker. */
const BIN_COLS = 4;
const BIN_ROW = 30;
const BIN_TOP = LANES_H + 6;
const BIN_PAD = 8;
const BIN_H =
  BIN_PAD * 2 + Math.ceil(CACHED_IDS.length / BIN_COLS) * BIN_ROW - 4;

// Beat timings, seconds into each phase.
const T = {
  single: { reveal: 4.5, end: 4.8 },
  atomized: { split: 0.5, move: 0.9, end: 2.6 },
  // runLen: time for the whole next-PR schedule
  cached: { change: 0.3, hits: 1.0, bin: 2.1, run: 3.0, runLen: 1.6, end: 4.9 },
};
const HOLD: Partial<Record<Phase, number>> = { single: 1200, atomized: 2200 };
const NEXT: Partial<Record<Phase, Phase>> = {
  single: 'atomized',
  atomized: 'cached',
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function Atomization() {
  const C = useC();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState<Phase>('single');
  const [auto, setAuto] = useState(true);
  const [replays, setReplays] = useState(0);
  const [t, setT] = useState(0);
  const end = T[phase].end;

  useEffect(() => {
    if (!inView) return;
    setT(reduced ? end : 0);
    const controls = reduced
      ? null
      : animate(0, end, { duration: end, ease: 'linear', onUpdate: setT });
    const next = NEXT[phase];
    const id =
      auto && next
        ? setTimeout(
            () => setPhase(next),
            (reduced ? 0 : end * 1000) + (HOLD[phase] ?? 0)
          )
        : undefined;
    return () => {
      controls?.stop();
      clearTimeout(id);
    };
  }, [inView, phase, replays, auto, reduced, end]);

  const time = inView ? t : 0;
  const next = phase === 'cached';
  // single: how many minutes of the schedule have played
  const played =
    phase === 'single'
      ? (Math.min(time, T.single.reveal) / T.single.reveal) * SINGLE.makespan
      : Infinity;
  const split = phase !== 'single' && (next || time >= T.atomized.split);
  const moved = next || (phase === 'atomized' && time >= T.atomized.move);
  const hits = next && time >= T.cached.hits;
  const binned = next && time >= T.cached.bin;
  const nextRun = next ? clamp01((time - T.cached.run) / T.cached.runLen) : 0;
  const changed = next && time >= T.cached.change;

  return (
    <div ref={box}>
      <Frame
        label="E2e test splitting (Atomization)"
        controls={
          <>
            <Steps
              steps={STEPS}
              phase={phase}
              onPick={(p) => {
                setAuto(false);
                setPhase(p);
                setReplays((r) => r + 1);
              }}
            />
            <ReplayButton
              onClick={() => {
                setAuto(true);
                setPhase('single');
                setReplays((r) => r + 1);
              }}
            />
          </>
        }
        footer={
          <Legend
            items={[
              { color: C.primary, label: 'e2e' },
              { color: C.task, label: 'build, lint, unit test' },
              { color: C.successFill, label: 'cache hit' },
            ]}
          />
        }
      >
        {/* next PR: the change, and who read it */}
        <div className="mb-3 min-h-[2.75em] sm:min-h-[1.5em]">
          <AnimatePresence mode="popLayout" initial={false}>
            {changed && (
              <motion.div
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-(--fig-fg2)"
                initial={{
                  opacity: 0,
                  y: reduced ? 0 : 4,
                  filter: 'blur(2px)',
                }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, transition: SWAP_OUT }}
                transition={SWAP_IN}
              >
                <span
                  className="rounded-md px-1.5 py-0.5 text-[12px] font-medium"
                  style={{ background: C.dangerBg, color: C.danger }}
                >
                  changed
                </span>
                <code className={`${MONO} text-[12px] text-(--fig-fg)`}>
                  src/features/cart/page.tsx
                </code>
                <span>→</span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[12px] font-semibold"
                  style={{ borderColor: C.cloud, color: C.cloudText }}
                >
                  Ultracache
                </span>
                <span>
                  of the {SPECS.length} specs, only{' '}
                  <code className={`${MONO} text-[12px] text-(--fig-fg)`}>
                    {specName(CHANGED_SPEC)}
                  </code>{' '}
                  read it
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-3">
          <div className="relative w-16 shrink-0">
            {Array.from({ length: WORKERS }, (_, w) => (
              <div
                key={w}
                className={`flex items-center justify-end text-xs text-(--fig-muted) transition-colors duration-200 ${binned && !NEXT_USED.has(w) ? 'line-through decoration-(--fig-muted)' : ''}`}
                style={{ height: LANE_H, marginBottom: LANE_GAP }}
              >
                worker {w + 1}
              </div>
            ))}
            <motion.div
              className="absolute inset-x-0 flex items-center justify-end text-xs text-(--fig-success)"
              style={{ top: BIN_TOP, height: BIN_H }}
              initial={false}
              animate={{ opacity: binned ? 1 : 0 }}
              transition={BASE}
            >
              cached
            </motion.div>
          </div>
          <motion.div
            className="relative flex-1"
            initial={false}
            animate={{ height: binned ? BIN_TOP + BIN_H : LANES_H }}
            transition={reduced ? { duration: 0 } : BASE}
          >
            {TICKS.map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2 text-[11px] text-(--fig-muted) tabular-nums"
                style={{ left: pct(m), top: AXIS_Y }}
              >
                {m}m
              </span>
            ))}
            {Array.from({ length: WORKERS }, (_, w) => (
              <div
                key={w}
                className="absolute inset-x-0 overflow-hidden rounded-md bg-(--fig-inset) ring-1 ring-(--fig-border)"
                style={{ top: laneTop(w), height: LANE_H }}
              >
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--fig-ghost)_5px_6px)] text-[13px] font-medium text-(--fig-muted)"
                  initial={false}
                  animate={{ opacity: binned && !NEXT_USED.has(w) ? 1 : 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { ...MOVE, delay: binned ? 0.5 : 0 }
                  }
                >
                  not needed
                </motion.div>
              </div>
            ))}
            <motion.div
              className="absolute inset-x-0 rounded-md bg-(--fig-inset) ring-1 ring-(--fig-border)"
              style={{ top: BIN_TOP, height: BIN_H }}
              initial={false}
              animate={{ opacity: binned ? 1 : 0 }}
              transition={BASE}
            />

            {IDS.map((id, k) => {
              const spec = isSpec(id);
              const s = (moved ? SLOTS_ATOM : SLOTS_SINGLE).get(id)!;
              const cached = hits && !RERUN.has(id);
              const ci = CACHED_IDS.indexOf(id);
              // next PR: reruns wait as an outline, then fill as they run again
              const rerun = next && RERUN.has(id);
              const ns = SLOTS_NEXT.get(id);
              const fill =
                rerun && hits && ns
                  ? clamp01((nextRun * NEXT_PR.makespan - ns.start) / ns.dur)
                  : null;
              // single: reveal along the schedule
              const shown =
                phase === 'single' ? clamp01((played - s.start) / s.dur) : 1;
              const first = spec && SPECS[0][0] === id;
              const last = spec && SPECS[SPECS.length - 1][0] === id;
              const label = !spec
                ? id
                : split
                  ? specName(id)
                  : first
                    ? 'shop-e2e:e2e'
                    : '';
              const pos =
                cached && binned
                  ? {
                      left: `calc(${BIN_PAD}px + ${ci % BIN_COLS} * (100% - ${BIN_PAD * 2}px) / ${BIN_COLS})`,
                      width: `calc((100% - ${BIN_PAD * 2}px) / ${BIN_COLS} - 6px)`,
                      top:
                        BIN_TOP + BIN_PAD + Math.floor(ci / BIN_COLS) * BIN_ROW,
                    }
                  : rerun && binned && ns
                    ? {
                        left: pct(ns.start),
                        width: `calc(${pct(ns.start + ns.dur)} - ${pct(ns.start)} - 2px)`,
                        top: laneTop(ns.worker) + (LANE_H - BAR_H) / 2,
                      }
                    : {
                        left: pct(s.start),
                        // inside the one big task the specs touch: no gap
                        width: `calc(${pct(s.start + s.dur)} - ${pct(s.start)} - ${split || !spec ? 2 : 0}px)`,
                        top: laneTop(s.worker) + (LANE_H - BAR_H) / 2,
                      };
              const solid = spec ? C.primary : C.task;
              const bg = cached
                ? C.successBg
                : fill !== null
                  ? C.surface
                  : solid;
              const text = cached
                ? C.success
                : spec && (fill === null || fill > 0.35)
                  ? C.onFill
                  : spec
                    ? C.primaryText
                    : C.taskText;
              return (
                <motion.div
                  key={`${id}-${replays}`}
                  title={
                    cached
                      ? `${specName(id)}: cache hit`
                      : split
                        ? specName(id)
                        : undefined
                  }
                  className={`${MONO} absolute flex items-center overflow-hidden px-2 text-[11px] whitespace-nowrap outline-1 -outline-offset-1 outline-dashed`}
                  initial={false}
                  animate={{
                    ...pos,
                    backgroundColor: bg,
                    color: text,
                    borderRadius:
                      split || !spec
                        ? 4
                        : first
                          ? '4px 0 0 4px'
                          : last
                            ? '0 4px 4px 0'
                            : 0,
                    boxShadow:
                      fill !== null
                        ? `inset 0 0 0 1px ${solid}`
                        : 'inset 0 0 0 0px transparent',
                    outlineColor: cached ? C.successFill : 'rgba(0,0,0,0)',
                    opacity: cached ? 0.8 : 1,
                    clipPath: `inset(0 ${(1 - shown) * 100}% 0 0)`,
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          default: {
                            ...MOVE,
                            delay:
                              phase === 'atomized' && moved
                                ? k * 0.05
                                : cached
                                  ? ci * 0.04
                                  : 0,
                          },
                          backgroundColor: {
                            ...BASE,
                            delay: cached ? k * 0.04 : 0,
                          },
                          color: { ...BASE, delay: cached ? k * 0.04 : 0 },
                          outlineColor: {
                            ...BASE,
                            delay: cached ? k * 0.04 : 0,
                          },
                          boxShadow: BASE,
                          opacity: BASE,
                          clipPath: { duration: 0 },
                        }
                  }
                  style={{ height: BAR_H }}
                >
                  {fill !== null && (
                    <span
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${fill * 100}%`, background: solid }}
                    />
                  )}
                  <span className="relative min-w-0 truncate">
                    {cached ? specName(id) : label}
                  </span>
                </motion.div>
              );
            })}
            {/* seams between the specs while they are still one task */}
            {!split &&
              SPECS.slice(1).map(([id]) => {
                const s = SLOTS_SINGLE.get(id)!;
                return (
                  <div
                    key={`seam-${id}`}
                    className="absolute w-px"
                    style={{
                      left: pct(s.start),
                      top: laneTop(s.worker) + (LANE_H - BAR_H) / 2 + 6,
                      height: BAR_H - 12,
                      background: C.onFill,
                      opacity: played >= s.start ? 0.35 : 0,
                    }}
                  />
                );
              })}
          </motion.div>
        </div>
      </Frame>
    </div>
  );
}
