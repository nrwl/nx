// #2a Task resource profiles, ahead of the packing figure. Blog version of the
// Oct 22 TaskProfilesV2 clip, with memory as a second constraint:
//   1. Profile: four tasks run one after another on one worker, each drawing
//      the CPU it used in earlier runs. The worker's CPU and memory sit below.
//   2. Pack: the tasks slide together where they fit. cart:test runs beside
//      shop:build, admin:build starts once shop:build's CPU drops. shop:e2e
//      fits on CPU next to admin:build, but not in memory, so it waits.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { Frame, Legend, ReplayButton, Steps, type Tokens, useC } from './kit';

type Phase = 'profile' | 'pack';
const STEPS: { id: Phase; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'pack', label: 'Pack' },
];

const MEM_GB = 16;
const MINUTES = 7;

interface Task {
  id: string;
  kind: 'build' | 'test' | 'e2e';
  dur: number;
  /** CPU share from a minute on, as recorded in earlier runs. */
  cpu: [number, number][];
  mem: number;
  /** Start one after another, the failed try (e2e only), and packed. */
  seq: [lane: number, start: number];
  tryAt?: [lane: number, start: number];
  packed: [lane: number, start: number];
}

const TASKS: Task[] = [
  {
    id: 'shop:build',
    kind: 'build',
    dur: 2,
    cpu: [
      [0, 0.8],
      [1.2, 0.15],
    ],
    mem: 6,
    seq: [0, 0],
    packed: [0, 0],
  },
  {
    id: 'admin:build',
    kind: 'build',
    dur: 2,
    cpu: [
      [0, 0.7],
      [1.2, 0.12],
    ],
    mem: 6,
    seq: [0, 2],
    packed: [1, 1.2],
  },
  {
    id: 'cart:test',
    kind: 'test',
    dur: 1.1,
    cpu: [[0, 0.15]],
    mem: 3,
    seq: [0, 4],
    packed: [1, 0],
  },
  {
    id: 'shop:e2e',
    kind: 'e2e',
    dur: 1.6,
    cpu: [[0, 0.2]],
    mem: 13,
    seq: [0, 5.1],
    tryAt: [0, 2],
    packed: [0, 3.2],
  },
];

// Beat timings in real seconds from the start of each phase.
const PROFILE = {
  draw: TASKS.map((_, i) => 0.4 + i * 1.15),
  drawLen: 1.05,
  end: 5.4,
};
const PACK = {
  cart: 0.5,
  admin: 1.4,
  len: 0.9,
  tryAt: 3.0,
  over: 4.0,
  wait: 6.6,
  done: 7.7,
  end: 8.2,
};
/** Pause on the last profile frame before packing starts. */
const HOLD_MS = 2200;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const inOut = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const ramp = (t: number, from: number, len: number) =>
  inOut(clamp01((t - from) / len));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Recorded CPU at minute `m` into the task, with short ramps and a little noise. */
function cpuAt(task: Task, m: number, seed: number): number {
  let v = task.cpu[0][1];
  for (let i = 1; i < task.cpu.length; i++) {
    const [at, to] = task.cpu[i];
    const from = task.cpu[i - 1][1];
    v = lerp(from, to, clamp01((m - at + 0.12) / 0.3));
    if (m < at - 0.12) {
      v = from;
      break;
    }
  }
  const rise = clamp01(m / 0.08);
  return (v + 0.015 * Math.sin(m * 9 + seed * 2.1)) * rise;
}

/** Memory climbs in the first seconds of a task, then holds. */
const memAt = (task: Task, m: number) =>
  task.mem * clamp01(m / 0.15) * (0.97 + 0.03 * Math.sin(m * 5));

interface Placed {
  task: Task;
  lane: number;
  start: number;
  /** Minutes drawn so far (profile phase). */
  ran: number;
  /** Over-memory highlight, 0..1. */
  over: number;
}

function place(phase: Phase, t: number): Placed[] {
  return TASKS.map((task, i) => {
    if (phase === 'profile') {
      const ran = task.dur * ramp(t, PROFILE.draw[i], PROFILE.drawLen);
      return {
        task,
        lane: task.seq[0],
        start: task.seq[1],
        ran,
        over: 0,
      };
    }
    let lane = task.seq[0];
    let start = task.seq[1];
    let over = 0;
    if (task.id === 'cart:test' || task.id === 'admin:build') {
      const k = ramp(
        t,
        task.id === 'cart:test' ? PACK.cart : PACK.admin,
        PACK.len
      );
      lane = lerp(task.seq[0], task.packed[0], k);
      start = lerp(task.seq[1], task.packed[1], k);
    } else if (task.tryAt) {
      const k1 = ramp(t, PACK.tryAt, PACK.len);
      const k2 = ramp(t, PACK.wait, PACK.len);
      start = lerp(lerp(task.seq[1], task.tryAt[1], k1), task.packed[1], k2);
      over = clamp01((t - PACK.over) / 0.25) * (1 - k2);
    }
    return { task, lane, start, ran: task.dur, over };
  });
}

/** The worker's total at minute `m`, from whatever is drawn so far. */
function total(
  placed: Placed[],
  m: number,
  of: (task: Task, into: number, seed: number) => number
) {
  let sum = 0;
  placed.forEach((p, i) => {
    if (m >= p.start && m < p.start + p.ran) sum += of(p.task, m - p.start, i);
  });
  return sum;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

const kindColor = (C: Tokens) => ({
  build: C.chart2,
  test: C.chart1,
  e2e: C.chart3,
});

export default function TaskProfiles() {
  const C = useC();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState<Phase>('profile');
  const [auto, setAuto] = useState(true);
  const [replays, setReplays] = useState(0);
  const [t, setT] = useState(0);
  const dur = phase === 'profile' ? PROFILE.end : PACK.end;

  // Play the current phase; in auto mode, move on to packing after a pause.
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setT(dur);
    } else {
      setT(0);
    }
    const controls = reduced
      ? null
      : animate(0, dur, { duration: dur, ease: 'linear', onUpdate: setT });
    let next: ReturnType<typeof setTimeout> | undefined;
    if (auto && phase === 'profile')
      next = setTimeout(
        () => setPhase('pack'),
        (reduced ? 0 : dur * 1000) + HOLD_MS
      );
    return () => {
      controls?.stop();
      clearTimeout(next);
    };
  }, [inView, phase, replays, auto, reduced, dur]);

  const placed = place(phase, inView ? t : 0);
  const profiled = phase === 'pack' || t >= PROFILE.end - 0.3;
  const end = Math.max(...placed.map((p) => p.start + p.ran));

  return (
    <div ref={box}>
      <Frame
        label="Task resource profiles"
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
                setPhase('profile');
                setReplays((r) => r + 1);
              }}
            />
          </>
        }
        footer={
          <div className="flex flex-wrap items-end gap-4">
            <Legend
              items={[
                { color: C.chart2, label: 'build' },
                { color: C.chart1, label: 'test' },
                { color: C.chart3, label: 'e2e' },
                { color: C.dangerFill, label: 'over capacity' },
              ]}
            />
          </div>
        }
      >
        <Chart C={C} placed={placed} end={end} showEnd={profiled} />
      </Frame>
    </div>
  );
}

function Chart({
  C,
  placed,
  end,
  showEnd,
}: {
  C: Tokens;
  placed: Placed[];
  end: number;
  showEnd: boolean;
}) {
  const { ref, w } = useWidth();
  const narrow = w < 520;
  const x0 = narrow ? 58 : 72;
  const x1 = w - 4;
  const tx = (m: number) => x0 + (m / MINUTES) * (x1 - x0);
  const axisH = 18;
  const laneH = narrow ? 46 : 58;
  const laneGap = 6;
  const lanesTop = axisH + 6;
  const laneY = (lane: number) => lanesTop + lane * (laneH + laneGap);
  const stripH = 40;
  const stripCap = 26;
  const cpuTop = laneY(2) + 14;
  const memTop = cpuTop + stripH + 10;
  const H = memTop + stripH + 2;
  const colors = kindColor(C);
  const labelPad = 18;

  const strip = (
    key: string,
    top: number,
    label: string,
    color: string,
    of: (task: Task, into: number, seed: number) => number,
    cap: number
  ) => {
    const base = top + stripH;
    const capY = base - stripCap;
    const y = (v: number) => Math.max(top, base - (v / cap) * stripCap);
    const stop = Math.max(0, ...placed.map((p) => p.start + p.ran));
    const steps = Math.max(2, Math.ceil(stop / 0.025));
    const pts = Array.from({ length: steps + 1 }, (_, k) => {
      const m = (k / steps) * stop;
      return `${tx(m).toFixed(1)},${y(total(placed, Math.min(m, stop - 0.001), of)).toFixed(1)}`;
    });
    const area = `M${tx(0)},${base} L${pts.join(' L')} L${tx(stop)},${base} Z`;
    return (
      <g key={key}>
        <defs>
          <clipPath id={`${key}-ok`}>
            <rect x={x0} y={capY} width={x1 - x0} height={stripCap} />
          </clipPath>
          <clipPath id={`${key}-over`}>
            <rect x={x0} y={top - 2} width={x1 - x0} height={capY - top + 2} />
          </clipPath>
        </defs>
        <rect
          x={x0}
          y={capY}
          width={x1 - x0}
          height={stripCap}
          rx={4}
          fill={C.inset}
          stroke={C.border}
        />
        {stop > 0 && (
          <>
            <g clipPath={`url(#${key}-ok)`}>
              <path d={area} fill={color} fillOpacity={0.25} />
              <path
                d={`M${pts.join(' L')}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
              />
            </g>
            <g clipPath={`url(#${key}-over)`}>
              <path d={area} fill={C.dangerFill} fillOpacity={0.35} />
              <path
                d={`M${pts.join(' L')}`}
                fill="none"
                stroke={C.dangerFill}
                strokeWidth={1.5}
              />
            </g>
          </>
        )}
        <line
          x1={x0}
          x2={x1}
          y1={capY}
          y2={capY}
          stroke={C.muted}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={0} y={base - 16} fontSize={12} fontWeight={500} fill={C.fg2}>
          {label}
        </text>
        <text x={0} y={base - 2} fontSize={11} fill={C.muted}>
          {key === 'cpu' ? '8 cores' : `${MEM_GB} GB`}
        </text>
      </g>
    );
  };

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="block overflow-visible font-['Instrument_Sans',ui-sans-serif,system-ui,sans-serif]"
        role="img"
        aria-label="Four tasks on one worker, with the worker's CPU and memory over time"
      >
        {/* axis */}
        {Array.from({ length: MINUTES + 1 }, (_, m) => m).map((m) =>
          narrow && m % 2 ? null : (
            <text
              key={m}
              x={tx(m)}
              y={12}
              fontSize={11}
              fill={C.muted}
              textAnchor={m === 0 ? 'start' : m === MINUTES ? 'end' : 'middle'}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {m}m
            </text>
          )
        )}
        <text
          x={0}
          y={laneY(0) + 16}
          fontSize={12}
          fontWeight={600}
          fill={C.fg}
        >
          Worker
        </text>
        {[0, 1].map((l) => (
          <rect
            key={l}
            x={x0}
            y={laneY(l)}
            width={x1 - x0}
            height={laneH}
            rx={6}
            fill={C.inset}
            stroke={C.border}
          />
        ))}
        {placed.map((p, i) => {
          if (p.ran <= 0) return null;
          const c = colors[p.task.kind];
          const x = tx(p.start);
          const bw = tx(p.start + p.task.dur) - x;
          const drawnW = tx(p.start + p.ran) - x;
          const y = lerp(laneY(0), laneY(1), p.lane);
          const h = laneH;
          const scale = h - labelPad - 4;
          const n = Math.max(2, Math.ceil(p.ran / 0.03));
          const pts = Array.from({ length: n + 1 }, (_, k) => {
            const m = (k / n) * p.ran;
            return `${(x + tx(p.start + m) - tx(p.start)).toFixed(1)},${(
              y +
              h -
              2 -
              cpuAt(p.task, m, i) * scale
            ).toFixed(1)}`;
          });
          const clip = `bar-${i}`;
          const stroke = p.over > 0 ? C.dangerFill : c;
          return (
            <g key={p.task.id}>
              <defs>
                <clipPath id={clip}>
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={Math.max(0, drawnW - 2)}
                    height={h - 2}
                    rx={5}
                  />
                </clipPath>
              </defs>
              <rect
                x={x + 1}
                y={y + 1}
                width={Math.max(0, drawnW - 2)}
                height={h - 2}
                rx={5}
                fill={c}
                fillOpacity={0.12}
              />
              <g clipPath={`url(#${clip})`}>
                <path
                  d={`M${x},${y + h} L${pts.join(' L')} L${x + drawnW},${y + h} Z`}
                  fill={c}
                  fillOpacity={0.3}
                />
                <path
                  d={`M${pts.join(' L')}`}
                  fill="none"
                  stroke={c}
                  strokeWidth={1.5}
                />
                <text
                  x={x + 7}
                  y={y + 14}
                  fontSize={11}
                  fill={C.fg}
                  style={{
                    fontFamily: "'Server Mono', ui-monospace, monospace",
                  }}
                >
                  {p.task.id}
                </text>
                {bw > 120 && (
                  <text
                    x={x + bw - 7}
                    y={y + 14}
                    fontSize={11}
                    fill={C.fg2}
                    textAnchor="end"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {p.task.mem} GB
                  </text>
                )}
              </g>
              <rect
                x={x + 1}
                y={y + 1}
                width={Math.max(0, drawnW - 2)}
                height={h - 2}
                rx={5}
                fill="none"
                stroke={stroke}
                strokeWidth={p.over > 0 ? 1 + p.over : 1}
                strokeOpacity={p.over > 0 ? 1 : 0.7}
              />
            </g>
          );
        })}
        {strip(
          'cpu',
          cpuTop,
          'CPU',
          C.chart2,
          (task, m, seed) => cpuAt(task, m, seed),
          1
        )}
        {strip(
          'mem',
          memTop,
          'Memory',
          C.chart1,
          (task, m) => memAt(task, m),
          MEM_GB
        )}
        {showEnd && (
          <line
            x1={tx(end)}
            x2={tx(end)}
            y1={lanesTop - 4}
            y2={H}
            stroke={C.fg2}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        )}
      </svg>
    </div>
  );
}
