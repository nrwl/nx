// #3 Dynamic worker scaling, as a mechanism (no cost numbers: the toy
// simulator can't say how much real runs save). Three beats:
//   1. Start: the `small` workers start together with the pipeline. Nothing
//      is known about the work yet.
//   2. Size: the first Nx command reports the task graph. Affected tasks vs
//      cache hits light up, their share of recorded task time picks a size,
//      and the extra workers are requested.
//   3. Run: the extra workers boot (~15s in Jon's demo) and join in.
// Workers the size doesn't need are never started.
import { useEffect, useMemo, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
  BASE,
  CAPTION,
  Frame,
  INSTANT,
  Legend,
  ReplayButton,
  Segmented,
  Steps,
  useC,
  usePlayhead,
} from './kit';
import {
  ALL,
  CHANGES,
  JOIN_AT,
  LIMITS,
  SIZES,
  SLOTS,
  TOTAL_TIME,
  scenario,
  type Change,
} from './scaling-data';

type Phase = 'start' | 'size' | 'run';
const STEPS: { id: Phase; label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'size', label: 'Size' },
  { id: 'run', label: 'Run' },
];
const NEXT: Partial<Record<Phase, { to: Phase; ms: number }>> = {
  start: { to: 'size', ms: 1800 },
  size: { to: 'run', ms: 2800 },
};
const LANES = SIZES.large;
const ROW = 5;
const LANE_H = SLOTS * ROW + 8;
/** Minutes across the lanes, shared by all change sizes. */
const SCALE =
  Math.max(
    ...(Object.keys(CHANGES) as Change[]).map(
      (c) => scenario(c, 'sized').result.makespan
    )
  ) * 1.06;
const pct = (m: number) => `${(Math.min(m, SCALE) / SCALE) * 100}%`;
/** Screen seconds for the boot window. The real boot (~15s) is a sliver of
 * the run, so it's slowed down to make the extra workers visibly join late. */
const BOOT_SEC = 1.4;
const HATCH =
  'repeating-linear-gradient(135deg, transparent 0 4px, var(--fig-border-strong) 4px 5px)';
const PILLS: { size: keyof typeof SIZES; rule: string }[] = [
  { size: 'small', rule: `up to ${LIMITS.small * 100}%` },
  { size: 'medium', rule: `up to ${LIMITS.medium * 100}%` },
  { size: 'large', rule: 'more' },
];

export default function WorkerScaling() {
  const C = useC();
  const reduced = useReducedMotion();
  const [change, setChange] = useState<Change>('feature');
  const [phase, setPhase] = useState<Phase>('start');
  const [auto, setAuto] = useState(true);
  const [replays, setReplays] = useState(0);
  const sized = useMemo(() => scenario(change, 'sized'), [change]);
  const pb = usePlayhead(
    sized.result.makespan,
    `${change}-${replays}`,
    3.5,
    phase === 'run'
  );
  const inView = useInView(pb.ref, { once: true, amount: 0.35 });
  const known = phase !== 'start';
  // Schedule minutes → screen seconds, slower during the boot window.
  const at = (t: number) =>
    pb.spm === 0
      ? 0
      : t <= JOIN_AT
        ? (t / JOIN_AT) * BOOT_SEC
        : BOOT_SEC + (t - JOIN_AT) * pb.spm;
  const share = Math.round((sized.work / TOTAL_TIME) * 100);
  const added = sized.workers - SIZES.small;

  useEffect(() => {
    const next = NEXT[phase];
    if (!inView || !auto || !next) return;
    const id = setTimeout(() => setPhase(next.to), reduced ? 600 : next.ms);
    return () => clearTimeout(id);
  }, [inView, auto, phase, replays, reduced]);

  const restart = () => {
    setAuto(true);
    setPhase('start');
    setReplays((r) => r + 1);
  };

  return (
    <div ref={pb.ref}>
      <Frame
        label="Dynamic worker scaling"
        controls={
          <>
            <Steps
              steps={STEPS}
              phase={phase}
              onPick={(p) => {
                setAuto(false);
                setPhase(p);
              }}
            />
            <ReplayButton onClick={restart} />
          </>
        }
        footer={
          <Legend
            items={[
              { color: C.chart1, label: 'task' },
              { color: HATCH, label: 'starting up' },
              { color: C.mutedBg, label: 'not started' },
            ]}
          />
        }
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={change}
            onChange={(c) => {
              setChange(c);
              restart();
            }}
            options={(Object.keys(CHANGES) as Change[]).map((k) => ({
              value: k,
              label: CHANGES[k].label,
            }))}
          />
          <Pills picked={known ? sized.size : null} />
        </div>

        {/* the work, unknown until the first Nx command reports it */}
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className={`${CAPTION} text-(--fig-muted)`}>Task graph</span>
          <motion.span
            className={`${CAPTION} text-(--fig-fg2) tabular-nums`}
            initial={false}
            animate={{ opacity: known ? 1 : 0 }}
            transition={BASE}
          >
            {share}% of recorded task time
            {added > 0
              ? ` → ${sized.size}, +${added} workers`
              : ` → ${sized.size}, no workers added`}
          </motion.span>
        </div>
        <div className="mb-6 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
          {ALL.map((task, i) => {
            const run = sized.ids.has(task.id);
            return (
              <motion.div
                key={task.id}
                className="h-3 rounded-[3px]"
                initial={false}
                animate={{
                  backgroundColor: !known
                    ? C.mutedBg
                    : run
                      ? C.primary
                      : C.ghost,
                }}
                transition={
                  known && !reduced
                    ? {
                        ...BASE,
                        delay: (i % 24) * 0.015 + Math.floor(i / 24) * 0.05,
                      }
                    : INSTANT
                }
              />
            );
          })}
        </div>

        <div className="space-y-1.5">
          {Array.from({ length: LANES }, (_, w) => {
            const started = w < SIZES.small;
            const requested = known && w < sized.workers;
            const joins = !started && requested;
            // Extra workers boot while the small ones already run tasks, and
            // only light up once the playhead reaches the moment they join.
            const running = phase === 'run' && pb.playing;
            const on = started || (joins && running);
            const bootSec = at(JOIN_AT);
            const bars = sized.result.bars.filter((b) => b.worker === w);
            return (
              <div key={w} className="flex items-center gap-3">
                <motion.div
                  className="w-16 shrink-0 text-right text-xs text-(--fig-muted)"
                  initial={false}
                  animate={{ opacity: on ? 1 : 0.5 }}
                  transition={
                    reduced || !joins
                      ? { duration: 0.2 }
                      : { ...BASE, delay: running ? bootSec : 0 }
                  }
                >
                  worker {w + 1}
                </motion.div>
                <motion.div
                  className="relative flex-1 overflow-hidden rounded-md"
                  style={{ height: LANE_H }}
                  initial={false}
                  animate={{
                    backgroundColor: on ? C.inset : C.surface,
                    boxShadow: `inset 0 0 0 1px ${on || joins ? C.border : C.mutedBg}`,
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { ...BASE, delay: joins && running ? bootSec : 0 }
                  }
                >
                  {!started && (
                    <motion.span
                      className="absolute inset-0 flex items-center pl-2 text-[11px] text-(--fig-muted)"
                      initial={false}
                      animate={{ opacity: running && joins ? 0 : 0.6 }}
                      transition={reduced ? { duration: 0 } : BASE}
                    >
                      {joins ? 'requested' : 'not started'}
                    </motion.span>
                  )}
                  {joins && (
                    <motion.div
                      key={`boot-${pb.run}`}
                      className="absolute inset-y-0 left-0"
                      style={{ width: pct(JOIN_AT), background: HATCH }}
                      initial={{ clipPath: 'inset(0 100% 0 0)' }}
                      animate={{
                        clipPath: running
                          ? 'inset(0 0% 0 0)'
                          : 'inset(0 100% 0 0)',
                      }}
                      transition={
                        running
                          ? { duration: bootSec, ease: 'linear' }
                          : { duration: 0 }
                      }
                    />
                  )}
                  {bars.map((b) => (
                    <motion.div
                      key={`${pb.run}-${b.task.id}`}
                      className="absolute rounded-[2px]"
                      style={{
                        left: pct(b.start),
                        width: `calc(${pct(b.end)} - ${pct(b.start)} - 1px)`,
                        top: 4 + b.row * ROW + 1,
                        height: ROW - 2,
                        background: C.chart1,
                      }}
                      initial={{ clipPath: 'inset(0 100% 0 0)' }}
                      animate={{
                        clipPath: !pb.playing
                          ? 'inset(0 100% 0 0)'
                          : b.start < JOIN_AT && b.end > JOIN_AT
                            ? [
                                'inset(0 100% 0 0)',
                                `inset(0 ${(1 - (JOIN_AT - b.start) / (b.end - b.start)) * 100}% 0 0)`,
                                'inset(0 0% 0 0)',
                              ]
                            : 'inset(0 0% 0 0)',
                      }}
                      transition={
                        pb.playing
                          ? {
                              delay: at(b.start),
                              duration: at(b.end) - at(b.start),
                              ease: 'linear',
                              ...(b.start < JOIN_AT &&
                                b.end > JOIN_AT && {
                                  times: [
                                    0,
                                    (at(JOIN_AT) - at(b.start)) /
                                      (at(b.end) - at(b.start) || 1),
                                    1,
                                  ],
                                }),
                            }
                          : { duration: 0 }
                      }
                    />
                  ))}
                </motion.div>
              </div>
            );
          })}
        </div>
      </Frame>
    </div>
  );
}

/** The config's three sizes; `small` is on from the start, the pick lights up. */
function Pills({ picked }: { picked: keyof typeof SIZES | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <span className="font-['Server_Mono',ui-monospace,monospace] text-xs text-(--fig-muted)">
        workers:
      </span>
      {PILLS.map((p) => {
        const on = picked === p.size;
        const started = picked === null && p.size === 'small';
        return (
          <span
            key={p.size}
            className={`inline-flex items-baseline gap-1.5 rounded-lg px-2 py-0.5 transition-colors duration-200 ${
              on
                ? 'bg-(--fig-primary) text-white'
                : started
                  ? 'bg-(--fig-primary-bg) text-(--fig-primary-text)'
                  : 'bg-(--fig-muted-bg) text-(--fig-fg2)'
            }`}
          >
            <span className="font-medium">
              {p.size} {SIZES[p.size]}
            </span>
            <span
              className={`text-[11px] ${on ? 'text-white/80' : 'opacity-70'}`}
            >
              {p.rule}
            </span>
          </span>
        );
      })}
    </div>
  );
}
