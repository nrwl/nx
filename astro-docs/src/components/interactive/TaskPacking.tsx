// #2 Dynamic task packing. Each lane is a worker with 8 CPUs (lane height).
// Without packing: a fixed 2 tasks per worker, a lint still holds half of it.
// With packing: tasks fit by their recorded CPU profile. Plays without
// packing first, then every bar slides to its packed spot and worker 4 is
// no longer needed. A before/after toggle in the header switches between the two.
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  type Tokens,
  useC,
  Frame,
  Legend,
  ReplayButton,
  Segmented,
  Stat,
  usePlayhead,
} from './kit';
import { simulate, type SimBar, type SimTask } from './sim';
const CAPACITY = 8;
const SPEC: [string, number, number, string][] = [
  ['web:build', 4, 4, 'build'],
  ['api:build', 3, 4, 'build'],
  ['ui:build', 2, 3, 'build'],
  ['web:typecheck', 3, 3, 'build'],
  ['api:typecheck', 2, 3, 'build'],
  ['web:test', 4, 2, 'test'],
  ['api:test', 3, 2, 'test'],
  ['ui:test', 3, 2, 'test'],
  ['auth:test', 2, 2, 'test'],
  ['utils:test', 2, 1, 'test'],
  ['data:test', 2, 2, 'test'],
  ['web:lint', 2, 1, 'lint'],
  ['api:lint', 2, 1, 'lint'],
  ['ui:lint', 1, 1, 'lint'],
  ['auth:lint', 1, 1, 'lint'],
  ['utils:lint', 1, 1, 'lint'],
  ['data:lint', 1, 1, 'lint'],
  ['e2e:checkout', 4, 2, 'e2e'],
  ['e2e:search', 3, 2, 'e2e'],
  ['e2e:auth', 3, 2, 'e2e'],
];
const TASKS: SimTask[] = SPEC.map(([label, dur, cpu, kind]) => ({
  id: label,
  label,
  dur,
  cpu,
  kind,
}));

type Mode = 'static' | 'packed';
const WORKERS = 4;
const SLOTS = 2;
const RESULTS = {
  static: simulate(TASKS, {
    workers: WORKERS,
    mode: 'slots',
    slots: SLOTS,
    capacity: CAPACITY,
    priority: 'critical',
  }),
  packed: simulate(TASKS, {
    workers: 3,
    mode: 'pack',
    capacity: CAPACITY,
    priority: 'critical',
  }),
};
// In slot mode a slot owns CAPACITY / SLOTS CPUs; draw the task at its real
// CPU height inside the slot so the unused part of the slot stays visible.
const BARS: Record<Mode, Map<string, SimBar>> = {
  static: new Map(
    RESULTS.static.bars.map((b) => [
      b.task.id,
      {
        ...b,
        row: b.row * (CAPACITY / SLOTS),
        span: Math.min(b.task.cpu ?? 1, CAPACITY / SLOTS),
      },
    ])
  ),
  packed: new Map(RESULTS.packed.bars.map((b) => [b.task.id, b])),
};
const USED = {
  static: WORKERS,
  packed: new Set(RESULTS.packed.bars.map((b) => b.worker)).size,
};
// A worker is released once its last task ends, it doesn't wait for the
// others. Idle CPU and utilization only count time up to that point.
const endsOf = (mode: Mode) => {
  const ends: number[] = Array(WORKERS).fill(0);
  for (const b of RESULTS[mode].bars)
    ends[b.worker] = Math.max(ends[b.worker], b.end);
  return ends;
};
const ENDS = { static: endsOf('static'), packed: endsOf('packed') };
const utilizationOf = (mode: Mode) =>
  RESULTS[mode].cpuMinutes / (ENDS[mode].reduce((a, b) => a + b, 0) * CAPACITY);
const UTIL = {
  static: utilizationOf('static'),
  packed: utilizationOf('packed'),
};

const SCALE = 8;
const ROW = 7;
const LANE_H = CAPACITY * ROW + 8;
const LANE_GAP = 6;
const laneTop = (w: number) => w * (LANE_H + LANE_GAP);
const pct = (m: number) => `${(Math.min(m, SCALE) / SCALE) * 100}%`;
/** Bars slide to their new spot, the dropped worker grays out after. */
const MOVE = { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const };
const SETTLE_MS = 1100;
/** Pause on the finished unpacked schedule before packing it. */
const HOLD_MS = 1800;
const OPTIONS: { value: Mode; label: string }[] = [
  { value: 'static', label: 'Without packing' },
  { value: 'packed', label: 'With packing' },
];

const pctOf = (u: number) => `${Math.round(u * 100)}%`;

const kindColor = (C: Tokens): Record<string, string> => ({
  build: C.chart2,
  test: C.chart1,
  lint: C.chart3,
  e2e: C.chart4,
});

export default function TaskPacking() {
  const C = useC();
  const KIND_COLOR = kindColor(C);
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('static');
  // Stats follow the bars once they've settled.
  const [shown, setShown] = useState<Mode>('static');
  // The schedule a replay plays out; switching modes moves bars instead.
  const [played, setPlayed] = useState<Mode>('static');
  const [replays, setReplays] = useState(0);
  const [auto, setAuto] = useState(true);
  const pb = usePlayhead(RESULTS[played].makespan, `${played}-${replays}`, 4);

  // Once the unpacked run has played out, pack it.
  useEffect(() => {
    if (!auto || !pb.done || mode !== 'static') return;
    const id = setTimeout(() => setMode('packed'), reduced ? 0 : HOLD_MS);
    return () => clearTimeout(id);
  }, [auto, pb.done, mode, reduced]);

  useEffect(() => {
    if (mode === shown) return;
    const id = setTimeout(() => setShown(mode), reduced ? 0 : SETTLE_MS);
    return () => clearTimeout(id);
  }, [mode, shown, reduced]);

  const ready = pb.done && shown === mode;
  const good = shown === 'packed';

  return (
    <div ref={pb.ref}>
      <Frame
        label="Dynamic task packing"
        controls={
          <>
            <Segmented
              options={OPTIONS}
              value={mode}
              onChange={(m) => {
                setAuto(false);
                setMode(m);
              }}
            />
            <ReplayButton
              onClick={() => {
                setAuto(true);
                setMode('static');
                setPlayed('static');
                setShown('static');
                setReplays((r) => r + 1);
              }}
            />
          </>
        }
        footer={
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8">
              <Stat
                label="Utilization"
                reserve="100% → 100%"
                value={
                  !ready ? (
                    '…'
                  ) : good ? (
                    <>
                      <span className="text-(--fig-muted)">
                        {pctOf(UTIL.static)}
                      </span>
                      <span className="px-1.5 text-(--fig-muted)">→</span>
                      {pctOf(UTIL[shown])}
                    </>
                  ) : (
                    pctOf(UTIL[shown])
                  )
                }
                tone={ready ? (good ? 'good' : 'bad') : 'neutral'}
              />
            </div>
            <Legend
              items={[
                { color: C.chart2, label: 'build / typecheck' },
                { color: C.chart1, label: 'test' },
                { color: C.chart3, label: 'lint' },
                { color: C.chart4, label: 'e2e' },
                { color: C.dangerFill, label: 'idle CPU' },
              ]}
            />
          </div>
        }
      >
        <div className="flex gap-3">
          <div className="w-16 shrink-0">
            {Array.from({ length: WORKERS }, (_, w) => {
              const off = mode === 'packed' && w >= USED.packed;
              return (
                <div
                  key={w}
                  className="flex flex-col items-end justify-center text-right text-xs"
                  style={{ height: LANE_H, marginBottom: LANE_GAP }}
                >
                  <span
                    className={`transition-colors duration-200 ${off ? 'text-(--fig-muted) line-through decoration-(--fig-muted)' : 'text-(--fig-muted)'}`}
                  >
                    worker {w + 1}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="relative flex-1"
            style={{ height: laneTop(WORKERS) - LANE_GAP }}
          >
            {Array.from({ length: WORKERS }, (_, w) => {
              const off = mode === 'packed' && w >= USED.packed;
              const stop = ENDS[mode][w] || RESULTS[mode].makespan;
              return (
                <div
                  key={w}
                  className="absolute inset-x-0 overflow-hidden rounded-md bg-(--fig-inset) ring-1 ring-(--fig-border)"
                  style={{ top: laneTop(w), height: LANE_H }}
                >
                  {/* idle capacity: tinted under the bars, up to the end */}
                  <motion.div
                    key={`idle-${played}-${replays}`}
                    className="absolute top-1 bottom-1 left-0"
                    style={{ background: C.dangerWash }}
                    initial={{
                      clipPath: 'inset(0 100% 0 0)',
                      width: pct(stop),
                    }}
                    animate={{
                      clipPath: pb.playing
                        ? 'inset(0 0% 0 0)'
                        : 'inset(0 100% 0 0)',
                      width: pct(stop),
                      opacity: off ? 0 : 1,
                    }}
                    transition={{
                      clipPath: pb.playing
                        ? {
                            duration:
                              (ENDS[played][w] || RESULTS[played].makespan) *
                              pb.spm,
                            ease: 'linear',
                          }
                        : { duration: 0 },
                      width: reduced ? { duration: 0 } : MOVE,
                      opacity: reduced
                        ? { duration: 0 }
                        : { ...MOVE, delay: 0.5 },
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--fig-ghost)_5px_6px)] text-[13px] font-medium text-(--fig-muted)"
                    initial={false}
                    animate={{ opacity: off ? 1 : 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { ...MOVE, delay: off ? 0.5 : 0 }
                    }
                  >
                    not needed
                  </motion.div>
                </div>
              );
            })}
            {TASKS.map((t) => {
              const b = BARS[mode].get(t.id)!;
              const from = BARS[played].get(t.id)!;
              return (
                <motion.div
                  key={`${t.id}-${played}-${replays}`}
                  title={`${t.label} · ${t.dur}m · ${t.cpu} CPUs`}
                  className="absolute rounded-[3px]"
                  initial={{
                    clipPath: 'inset(0 100% 0 0)',
                    left: pct(b.start),
                    width: `calc(${pct(b.end)} - ${pct(b.start)} - 1px)`,
                    top: laneTop(b.worker) + 4 + b.row * ROW + 1,
                    height: b.span * ROW - 2,
                  }}
                  animate={{
                    clipPath: pb.playing
                      ? 'inset(0 0% 0 0)'
                      : 'inset(0 100% 0 0)',
                    left: pct(b.start),
                    width: `calc(${pct(b.end)} - ${pct(b.start)} - 1px)`,
                    top: laneTop(b.worker) + 4 + b.row * ROW + 1,
                    height: b.span * ROW - 2,
                  }}
                  transition={{
                    clipPath: pb.playing
                      ? {
                          delay: from.start * pb.spm,
                          duration: (from.end - from.start) * pb.spm,
                          ease: 'linear',
                        }
                      : { duration: 0 },
                    default: reduced
                      ? { duration: 0 }
                      : {
                          ...MOVE,
                          delay: Math.min(b.start, from.start) * 0.03,
                        },
                  }}
                  style={{ background: KIND_COLOR[t.kind ?? 'test'] }}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="w-16 shrink-0" />
          <div className="relative h-5 flex-1">
            {[0, 5].map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2 text-[11px] text-(--fig-muted) tabular-nums"
                style={{ left: pct(m) }}
              >
                {m}m
              </span>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}
