// Shared building blocks for the interactive blog figures: frame, controls,
// stats, a playhead that starts when the figure scrolls into view, and a Gantt
// lane renderer for simulator output. Colors follow the 2026 Nx brand ramps
// (Primary + Cloud + Neutral; Success/Warning/Danger only for meaning).
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { nxColors } from './brand-tokens';
import { fmtMin, type SimBar } from './sim';

// Nx 2026 brand tokens for the figures, light and dark, from the brand ramps
// (@packages/nx-brand). Nx Cloud artwork: Primary + Cloud + Neutral. Success,
// Warning and Danger only where they mean something (idle, queued, changed).
const n = nxColors;
const alpha = (hex: string, a: number) =>
  hex +
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');

function tokens(dark: boolean) {
  const d = <T,>(dk: T, lt: T) => (dark ? dk : lt);
  return {
    // canvas (brand canvas roles / design-system base tokens)
    surface: d(n.neutral['900'], '#FFFFFF'),
    inset: d(n.neutral['950'], n.neutral['50']),
    mutedBg: d(n.neutral['800'], n.neutral['100']),
    border: d(n.neutral['800'], n.neutral['200']),
    borderStrong: d(n.neutral['700'], n.neutral['300']),
    fg: d(n.neutral['100'], n.neutral['950']),
    fg2: d(n.neutral['300'], n.neutral['600']),
    muted: d(n.neutral['400'], n.neutral['500']),
    // data
    primary: n.primary['500'],
    primarySoft: d(n.primary['800'], n.primary['200']),
    primaryWash: d(alpha(n.primary['500'], 0.2), alpha(n.primary['500'], 0.12)),
    primaryText: d(n.primary['300'], n.primary['600']),
    primaryBg: d(n.primary['950'], n.primary['50']),
    cloud: d(n.cloud['400'], n.cloud['500']),
    cloudText: d(n.cloud['300'], n.cloud['700']),
    task: d(n.neutral['700'], n.neutral['300']),
    taskText: d(n.neutral['100'], n.neutral['800']),
    ghost: d(alpha(n.neutral['500'], 0.22), alpha(n.neutral['400'], 0.22)),
    edge: d(n.neutral['700'], n.neutral['300']),
    // design-system chart series: Cloud and Primary alternating
    chart1: d(n.cloud['400'], n.cloud['500']),
    chart2: d(n.primary['400'], n.primary['500']),
    chart3: d(n.cloud['200'], n.cloud['800']),
    chart4: d(n.primary['700'], n.primary['300']),
    // meaning
    success: d(n.success['400'], n.success['700']),
    successFill: n.success['500'],
    successBg: d(n.success['950'], n.success['50']),
    warning: d(n.warning['400'], n.warning['700']),
    warningFill: d(n.warning['400'], n.warning['500']),
    danger: d(n.danger['400'], n.danger['700']),
    dangerFill: n.danger['500'],
    dangerWash: d(alpha(n.danger['500'], 0.18), alpha(n.danger['500'], 0.1)),
    dangerBg: d(n.danger['950'], n.danger['50']),
    onFill: '#FFFFFF',
    ink: n.neutral['950'],
    segActive: d(n.neutral['700'], '#FFFFFF'),
  };
}
export type Tokens = ReturnType<typeof tokens>;
const LIGHT = tokens(false);
const DARK = tokens(true);

// Follows data-theme="dark" on <html>, the hook the Nx blog uses.
const subscribeTheme = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  });
  return () => mo.disconnect();
};
const isDark = () => document.documentElement.dataset.theme === 'dark';

/** Brand tokens for the current theme. */
export function useC(): Tokens {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  return dark ? DARK : LIGHT;
}

/** Tokens as CSS vars, so class names can read them: text-(--fig-muted). */
function cssVars(t: Tokens): CSSProperties {
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries(t))
    v[`--fig-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`] = val;
  return v as CSSProperties;
}

// Motion tokens from the brand guidelines (motion-instant / -base and the
// content-swap pattern). Schedule playback stays linear: it shows progress.
export const INSTANT = { duration: 0.12, ease: [0.4, 0, 0.2, 1] as const };
export const BASE = { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };
export const SWAP_IN = { duration: 0.24, ease: [0.2, 0, 0, 1] as const };
export const SWAP_OUT = { duration: 0.14, ease: [0.4, 0, 1, 1] as const };

/** Brand type roles. Mono is for code only: task ids, file paths. */
export const CAPTION =
  'text-[13px] leading-[1.4] font-medium tracking-[0.01em]';
export const MONO = "font-['Server_Mono',ui-monospace,monospace]";

/** Press feedback (brand: scale 0.97 while active, 150ms ease-out). */
export const PRESS =
  'transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97]';
/** Same for motion buttons. */
export const TAP = { scale: 0.97 };

let lastPointer = 'mouse';
/**
 * Hover to inspect with a mouse, tap to toggle on touch. Plain mouseenter
 * breaks on touch: the emulated enter sets the focus and the click that
 * follows toggles it off again.
 */
export function hoverOrTap(
  id: string,
  current: string | null,
  set: (id: string | null) => void
) {
  return {
    onPointerDown: (e: { pointerType: string }) => {
      lastPointer = e.pointerType;
    },
    onPointerEnter: (e: { pointerType: string }) => {
      if (e.pointerType === 'mouse') set(id);
    },
    onPointerLeave: (e: { pointerType: string }) => {
      if (e.pointerType === 'mouse') set(null);
    },
    onClick: (e: { detail: number }) => {
      // detail 0 = keyboard activation
      if (e.detail === 0 || lastPointer !== 'mouse')
        set(current === id ? null : id);
    },
  };
}

export function Frame({
  label,
  controls,
  children,
  footer,
}: {
  label: string;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const C = useC();
  // Card per the brand: surface, 1px border, lg radius, no shadow. The token
  // vars set here theme every figure inside it.
  return (
    <div
      className="overflow-hidden rounded-2xl border border-(--fig-border) bg-(--fig-surface) font-['Instrument_Sans',ui-sans-serif,system-ui,sans-serif] text-(--fig-fg) transition-colors duration-150"
      style={cssVars(C)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--fig-border) px-4 py-3 sm:px-6">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-(--fig-fg)">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-2">{controls}</div>
      </div>
      <div className="px-4 py-6 sm:px-6">{children}</div>
      {footer && (
        <div className="border-t border-(--fig-border) px-4 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const reduced = useReducedMotion();
  // Tab list: muted track, the active option lifts to a surface pill.
  return (
    <div
      role="radiogroup"
      className="relative flex rounded-[10px] bg-(--fig-muted-bg) p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 cursor-pointer rounded-lg px-3 py-1 text-[13px] font-medium ${PRESS} ${
              active
                ? 'text-(--fig-fg)'
                : 'text-(--fig-muted) hover:text-(--fig-fg)'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join('-')}`}
                className="absolute inset-0 -z-10 rounded-lg bg-(--fig-seg-active) shadow-[0_1px_2px_rgba(12,12,13,0.06)]"
                transition={reduced ? { duration: 0 } : BASE}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-(--fig-border) bg-(--fig-surface) px-3 py-1 text-[13px] font-medium text-(--fig-fg2) hover:text-(--fig-fg) ${PRESS}`}
    >
      Replay
    </button>
  );
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  reserve,
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'good' | 'bad';
  /** Widest text the value can take (e.g. "00m 00s"). Its width is kept
   * while the value changes, so neighbouring stats don't shift. */
  reserve?: string;
}) {
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const color =
    tone === 'good'
      ? 'text-(--fig-success)'
      : tone === 'bad'
        ? 'text-(--fig-danger)'
        : 'text-(--fig-fg)';
  // Brand content swap: in from opacity 0, translateY 4px, blur 2px. Live
  // values (the clock) don't swap.
  const key =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : 'live';
  return (
    <div className="min-w-0">
      <div className={`${CAPTION} text-(--fig-muted)`}>{label}</div>
      <div className="mt-0.5 grid text-2xl leading-tight font-semibold tracking-[-0.015em] tabular-nums">
        {reserve && (
          <span aria-hidden className="invisible col-start-1 row-start-1">
            {reserve}
          </span>
        )}
        <motion.div
          key={key}
          className={`col-start-1 row-start-1 whitespace-nowrap transition-colors duration-150 ${color}`}
          initial={
            mounted.current
              ? { opacity: 0, y: reduced ? 0 : 4, filter: 'blur(2px)' }
              : false
          }
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={SWAP_IN}
        >
          {value}
        </motion.div>
      </div>
    </div>
  );
}

export interface Playback {
  // RefObject<T>, not RefObject<T | null>: assignable to `ref` under both the
  // React 18 types (docs) and the React 19 types (blog).
  ref: RefObject<HTMLDivElement>;
  /** Changes on every restart; used as a key so bar animations remount. */
  run: string;
  /** Real seconds per schedule minute (0 with reduced motion). */
  spm: number;
  playing: boolean;
  done: boolean;
  /** Schedule minutes elapsed, animated outside React. */
  clock: MotionValue<number>;
  replay: () => void;
}

/**
 * Playback for a schedule of `total` minutes, shown in about `seconds` real
 * seconds. Starts once the figure scrolls into view and restarts when
 * `resetKey` changes or on replay(). Bars animate on their own Motion
 * timelines, so React doesn't re-render while it plays.
 */
export function usePlayhead(
  total: number,
  resetKey: unknown,
  seconds = 4,
  /** Hold the clock at 0 until true (e.g. while an intro plays). */
  enabled = true
): Playback {
  const ref = useRef<HTMLDivElement>(null!);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();
  const spm = reduced ? 0 : seconds / Math.max(total, 0.001);
  const [replays, setReplays] = useState(0);
  const [done, setDone] = useState(false);
  const clock = useMotionValue(0);
  const run = `${String(resetKey)}-${replays}`;

  useEffect(() => {
    setDone(false);
    clock.set(0);
    if (!inView || !enabled) return;
    const controls = animate(clock, total, {
      duration: total * spm,
      ease: 'linear',
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
  }, [inView, enabled, run, total, spm, clock]);

  return {
    ref,
    run,
    spm,
    playing: inView && enabled,
    done,
    clock,
    replay: () => setReplays((r) => r + 1),
  };
}

/** Elapsed schedule time, rendered by Motion without React re-renders. */
export function Clock({ pb }: { pb: Playback }) {
  const text = useTransform(pb.clock, (v) => fmtMin(v));
  return <motion.span>{text}</motion.span>;
}

const CLIPPED = 'inset(0 100% 0 0)';
const OPEN = 'inset(0 0% 0 0)';

/**
 * Worker lanes with bars from the simulator. `scale` is the minute value at
 * the right edge, shared across toggles so schedules compare visually.
 */
export function Gantt({
  lanes,
  rows,
  bars,
  pb,
  end,
  scale,
  color,
  textColor = () => '#FFFFFF',
  barProps,
  laneLabel = (i) => `worker ${i + 1}`,
  laneOnline,
  rowHeight = 7,
  barLabel = true,
  emptyRowFill,
}: {
  lanes: number;
  rows: number;
  bars: SimBar[];
  pb: Playback;
  /** Minute the idle fill stops at (default: last bar end). */
  end?: number;
  scale: number;
  color: (b: SimBar) => string;
  /** Bar label color; defaults to white on the fill. */
  textColor?: (b: SimBar) => string;
  /** Extra handlers per bar (hover, tap). Must not set `style`. */
  barProps?: (b: SimBar) => Record<string, unknown>;
  laneLabel?: (i: number) => string;
  laneOnline?: number[];
  rowHeight?: number;
  barLabel?: boolean;
  /** Paint each row's idle time, e.g. to show wasted capacity. */
  emptyRowFill?: string;
}) {
  const pct = (m: number) => `${(Math.min(m, scale) / scale) * 100}%`;
  const laneH = rows * rowHeight + 8;
  const stop = end ?? Math.max(0, ...bars.map((b) => b.end));
  const reveal = (from: number, to: number) => ({
    initial: { clipPath: CLIPPED },
    animate: pb.playing ? { clipPath: OPEN } : { clipPath: CLIPPED },
    // Reveal on the schedule's timeline; clear instantly when playback stops
    // (e.g. stepping back to an earlier beat) instead of rewinding.
    transition: pb.playing
      ? {
          delay: from * pb.spm,
          duration: Math.max(0, to - from) * pb.spm,
          ease: 'linear' as const,
        }
      : { duration: 0 },
  });
  return (
    <div className="space-y-1.5">
      {Array.from({ length: lanes }, (_, w) => {
        const online = laneOnline?.[w] ?? 0;
        const laneBars = bars.filter((b) => b.worker === w);
        return (
          <div key={w} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right text-xs text-(--fig-muted)">
              {laneLabel(w)}
            </div>
            <div
              className="relative flex-1 rounded-md bg-(--fig-inset) ring-1 ring-(--fig-border)"
              style={{ height: laneH }}
            >
              {online > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-l-md bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--fig-ghost)_4px_5px)]"
                  style={{ width: pct(online) }}
                />
              )}
              {emptyRowFill &&
                stop > online &&
                Array.from({ length: rows }, (_, r) => (
                  <motion.div
                    key={`${pb.run}-idle-${r}`}
                    className="absolute"
                    {...reveal(online, stop)}
                    style={{
                      left: pct(online),
                      width: `calc(${pct(stop)} - ${pct(online)})`,
                      top: 4 + r * rowHeight + 1,
                      height: rowHeight - 2,
                      background: emptyRowFill,
                    }}
                  />
                ))}
              {laneBars.map((b) => (
                <motion.div
                  key={`${pb.run}-${b.task.id}`}
                  title={`${b.task.label} · ${b.task.dur}m`}
                  className={`absolute overflow-hidden rounded-[3px] px-1.5 text-[10px] leading-none transition-[background-color,color] duration-150 ${MONO} ${barProps ? 'cursor-pointer' : ''}`}
                  {...reveal(b.start, b.end)}
                  {...barProps?.(b)}
                  style={{
                    left: pct(b.start),
                    width: `calc(${pct(b.end)} - ${pct(b.start)} - 1px)`,
                    top: 4 + b.row * rowHeight + 1,
                    height: b.span * rowHeight - 2,
                    background: color(b),
                    color: textColor(b),
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {barLabel && b.span * rowHeight >= 12 ? b.task.label : null}
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0" />
        <div className="relative h-5 flex-1">
          {Array.from(
            { length: Math.floor(scale / 5) + 1 },
            (_, i) => i * 5
          ).map((m) => (
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
    </div>
  );
}

/** Numbered, clickable beats for the figure header. */
export function Steps<T extends string>({
  steps,
  phase,
  onPick,
}: {
  steps: { id: T; label: string }[];
  phase: T;
  onPick: (p: T) => void;
}) {
  const at = steps.findIndex((s) => s.id === phase);
  return (
    <ol className="flex items-center gap-1 text-[13px] font-medium">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1">
          {i > 0 && <span className="h-px w-3 bg-(--fig-border)" />}
          <button
            type="button"
            aria-current={i === at ? 'step' : undefined}
            onClick={() => onPick(s.id)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-(--fig-muted-bg) ${PRESS} ${
              i <= at ? 'text-(--fig-fg)' : 'text-(--fig-muted)'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors duration-150 ${
                i === at
                  ? 'bg-(--fig-primary) text-white'
                  : i < at
                    ? 'bg-(--fig-primary-bg) text-(--fig-primary-text)'
                    : 'bg-(--fig-muted-bg) text-(--fig-muted)'
              }`}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Small legend chip row. */
export function Legend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span
          key={i.label}
          className="inline-flex items-center gap-1.5 text-[13px] text-(--fig-fg2)"
        >
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
