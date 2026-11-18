// Benchmarks: nrwl/new-cloud-bench (511 projects, 1,634 tasks). The same
// pipeline with Nx remote caching only (one VM per task type, no distribution)
// on GitHub Actions, vs Nx Cloud CI. Weighted 80% feature / 17% large / 3%
// full-rebuild changes, clock and compute including setup. README weighted
// table: clock 47.07 / 4.42 min, compute 66.11 / 14.09 VM-min. Nx Cloud:
// 10.6x faster, 78.7% less compute vs GHA.
import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Frame, useC } from './kit';

type Run = 'gha' | 'nx';
const RUNS: { id: Run; label: string }[] = [
  { id: 'gha', label: 'GitHub Actions + Nx remote cache' },
  { id: 'nx', label: 'Nx Cloud CI' },
];
/** Weighted minutes per run (wall clock) and VM-minutes per run (compute). */
const CLOCK: Record<Run, number> = { gha: 47.07, nx: 4.42 };
const COMPUTE: Record<Run, number> = { gha: 66.11, nx: 14.09 };
const maxOf = (m: Record<Run, number>) => Math.max(...Object.values(m));
const fmt = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());

const GROW = { duration: 0.9, ease: [0.32, 0.72, 0, 1] as const };

export default function Benchmarks() {
  const C = useC();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.35 });
  const color: Record<Run, string> = {
    gha: C.task,
    nx: C.primary,
  };

  return (
    <div ref={box}>
      <Frame label="Benchmark: 511-project monorepo">
        <div className="grid gap-7">
          <Group
            title="Wall clock"
            aside={
              <span className="text-xs text-(--fig-muted)">
                minutes per run, weighted
              </span>
            }
          >
            {RUNS.map((r, i) => (
              <Bar
                key={r.id}
                label={r.label}
                frac={CLOCK[r.id] / maxOf(CLOCK)}
                color={color[r.id]}
                value={
                  r.id === 'nx'
                    ? `${fmt(CLOCK.nx)} min, ${(CLOCK.gha / CLOCK.nx).toFixed(1)}x faster`
                    : `${fmt(CLOCK[r.id])} min`
                }
                strong={r.id === 'nx'}
                delay={i * 0.2}
                show={inView}
                reduced={!!reduced}
              />
            ))}
          </Group>
          <Group
            title="Compute"
            aside={
              <span className="text-xs text-(--fig-muted)">
                VM-minutes per run, weighted
              </span>
            }
          >
            {RUNS.map((r, i) => (
              <Bar
                key={r.id}
                label={r.label}
                frac={COMPUTE[r.id] / maxOf(COMPUTE)}
                color={color[r.id]}
                value={
                  r.id === 'nx'
                    ? `${fmt(COMPUTE.nx)} VM-min, ${Math.round((1 - COMPUTE.nx / COMPUTE.gha) * 100)}% less`
                    : `${fmt(COMPUTE[r.id])} VM-min`
                }
                strong={r.id === 'nx'}
                delay={0.4 + i * 0.2}
                show={inView}
                reduced={!!reduced}
              />
            ))}
          </Group>
        </div>
      </Frame>
    </div>
  );
}

function Group({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-(--fig-fg)">{title}</span>
        {aside}
      </div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function Bar({
  label,
  frac,
  color,
  value,
  strong,
  delay,
  show,
  reduced,
}: {
  label: string;
  frac: number;
  color: string;
  value: string;
  strong?: boolean;
  delay: number;
  show: boolean;
  reduced: boolean;
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-3 sm:grid-cols-[13.5rem_1fr]">
      <span className="truncate text-xs text-(--fig-fg2)">{label}</span>
      <div className="flex h-6 items-center gap-2">
        <motion.div
          className="h-full shrink-0 rounded-[4px]"
          style={{ background: color }}
          initial={{ width: '0%' }}
          animate={{ width: show ? `calc(${frac * 100}% * 0.72)` : '0%' }}
          transition={reduced ? { duration: 0 } : { ...GROW, delay }}
        />
        <motion.span
          className={`text-[13px] whitespace-nowrap tabular-nums ${strong ? 'font-semibold text-(--fig-fg)' : 'text-(--fig-fg2)'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.25, delay: delay + 0.6 }
          }
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}
