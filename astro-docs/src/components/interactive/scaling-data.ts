import { simulate, type SimTask } from './sim';

// 48 tasks with a recorded duration from earlier runs.
export const ALL: SimTask[] = Array.from({ length: 48 }, (_, i) => {
  const dur = [2, 3, 1, 4, 2, 3, 2, 1][i % 8] + (i % 5 === 0 ? 1 : 0);
  return { id: `t${i}`, label: `t${i}`, dur, cpu: 1 };
});
export const TOTAL_TIME = ALL.reduce((s, t) => s + t.dur, 0);

export const CHANGES = {
  small: { label: 'Small fix', run: 6 },
  feature: { label: 'Feature', run: 24 },
  large: { label: 'Large change', run: 40 },
} as const;
export type Change = keyof typeof CHANGES;

// Spread the affected tasks over the grid so cache hits and misses mix.
export function affectedIds(change: Change): Set<string> {
  const n = CHANGES[change].run;
  const ids = new Set<string>();
  const step = ALL.length / n;
  for (let k = 0; k < n; k++) ids.add(ALL[Math.floor(k * step)].id);
  return ids;
}

export const SIZES = { small: 3, medium: 6, large: 8 } as const;
/** Upper bound of stored task time per size, the Nx Cloud defaults (the rest is large). */
export const LIMITS = { small: 0.33, medium: 0.66 } as const;
export const FIXED = SIZES.large;
/** Minute at which the extra workers can take work: they're requested once
 * the Nx command reports the task graph, then boot. In Jon's demo that took
 * ~15s from the command to their first task. */
export const JOIN_AT = 0.25;
export const SLOTS = 3;

export function pickSize(work: number): keyof typeof SIZES {
  if (work <= TOTAL_TIME * LIMITS.small) return 'small';
  if (work <= TOTAL_TIME * LIMITS.medium) return 'medium';
  return 'large';
}

const busy = (
  bars: { worker: number; start: number; end: number }[],
  w: number,
  now: number
) => bars.filter((b) => b.worker === w && b.start <= now && b.end > now).length;

export function scenario(change: Change, policy: 'fixed' | 'sized') {
  const ids = affectedIds(change);
  const tasks = ALL.filter((t) => ids.has(t.id));
  const work = tasks.reduce((s, t) => s + t.dur, 0);
  const size = pickSize(work);
  const workers = policy === 'fixed' ? FIXED : SIZES[size];
  const workerStart = Array.from({ length: workers }, (_, i) =>
    policy === 'fixed' || i < SIZES.small ? 0 : JOIN_AT
  );
  const result = simulate(tasks, {
    workers,
    capacity: SLOTS,
    mode: 'slots',
    slots: SLOTS,
    priority: 'critical',
    workerStart,
    // Idle workers pull work first: offer each task to the least busy
    // worker, so a few tasks spread out instead of stacking on worker 1.
    workerOrder: (now, n, _task, bars) =>
      Array.from({ length: n }, (_, w) => w).sort(
        (a, b) => busy(bars, a, now) - busy(bars, b, now) || a - b
      ),
  });
  return { ids, work, size, workers, workerStart, result };
}
