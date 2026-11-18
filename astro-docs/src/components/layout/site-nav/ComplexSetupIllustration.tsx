import { useEffect, useId, useRef, useState } from 'react';

// Port of the illustration in the nx.dev (Framer) "Complex Setup Card": five
// tangled connections that straighten into parallel lanes while hovered, with
// blue pulses running along them. Constants match the original component.
const LINE_COUNT = 5;
const LANE_GAP = 18;
const POINT_COUNT = 5;
const START_X = -24;
const SPREAD_Y = 78;
const JITTER_X = 16;
const STAGGER = 0.045;
const STIFFNESS = 26;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
const PULSE_LENGTH = 0.2;
const TRAIL_STEPS = 12;
const TRAIL_OPACITY = 0.17;
const TRAIL_SCALES = Array.from({ length: TRAIL_STEPS }, (_, i) =>
  Math.sqrt(1 - i / TRAIL_STEPS)
);
const LANE_SPEED = 0.42;
const LANE_OFFSET = 0.05;
const PULL = 0.8;
const MAX_PULL = 0.18;
const LINE_COLOR = 'rgb(64, 64, 62)';
const LINE_COLOR_ORGANIZED = 'rgb(83, 83, 81)';
const PULSE_COLORS = ['#1432E1', '#376BFB', '#8FB8FF'];

type Point = [number, number];

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LINES = (() => {
  const random = seededRandom(20);
  return Array.from({ length: LINE_COUNT }, (_, line) => {
    const y = 115 + (line - 2) * LANE_GAP;
    const organized = Array.from({ length: POINT_COUNT }, (_, i): Point => [
      START_X + (368 * i) / 4,
      y,
    ]);
    const tangled = organized.map(([px, py], i): Point => {
      if (i === 0 || i === 4) return [px, py];
      const x = px + (random() * 2 - 1) * JITTER_X;
      return [x, 115 + (random() * 2 - 1) * SPREAD_Y];
    });
    return {
      tangled,
      organized,
      speed: 0.2 + random() * 0.26,
      phase: random(),
    };
  });
})();

function toPath(points: Point[]) {
  let d = `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[i - 1] ?? points[i];
    const from = points[i];
    const to = points[i + 1];
    const after = points[i + 2] ?? to;
    const c1 = [
      from[0] + (to[0] - before[0]) / 6,
      from[1] + (to[1] - before[1]) / 6,
    ];
    const c2 = [
      to[0] - (after[0] - from[0]) / 6,
      to[1] - (after[1] - from[1]) / 6,
    ];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
  }
  return d;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (value: number) => value - Math.round(value);

interface Props {
  /** Straighten the connections into lanes (the card's hover state). */
  organized: boolean;
  /** Only animate while the card is actually on screen. */
  active: boolean;
}

export function ComplexSetupIllustration({ organized, active }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const pulseId = `cs-pulse-${id}`;
  const glowId = `cs-glow-${id}`;
  const fadeId = `cs-fade-${id}`;
  const softId = `cs-soft-${id}`;

  const goal = organized ? 1 : 0;
  const goalRef = useRef(goal);
  const sim = useRef({
    value: LINES.map(() => 0),
    velocity: LINES.map(() => 0),
    target: LINES.map(() => 0),
    switchAt: LINES.map(() => 0),
    position: LINES.map((line) => line.phase),
    shared: 0,
    time: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (goalRef.current === goal) return;
    goalRef.current = goal;
    const state = sim.current;
    LINES.forEach((_, i) => {
      const order = goal ? i : LINES.length - 1 - i;
      state.switchAt[i] = state.time + order * STAGGER;
    });
  }, [goal]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previous: number | null = null;
    const step = (now: number) => {
      const dt =
        previous === null ? 0 : Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const state = sim.current;
      state.time += dt;
      for (let i = 0; i < LINES.length; i++) {
        if (state.time >= state.switchAt[i]) state.target[i] = goalRef.current;
        if (reducedMotion) {
          state.value[i] = state.target[i];
          state.velocity[i] = 0;
        } else {
          const force =
            STIFFNESS * (state.target[i] - state.value[i]) -
            DAMPING * state.velocity[i];
          state.velocity[i] += force * dt;
          state.value[i] += state.velocity[i] * dt;
        }
        const t = Math.min(1, Math.max(0, state.value[i]));
        const offset = wrap(state.shared - i * LANE_OFFSET - state.position[i]);
        const pull = Math.min(MAX_PULL, Math.max(-0.18, offset * PULL)) * t;
        state.position[i] += dt * (lerp(LINES[i].speed, LANE_SPEED, t) + pull);
      }
      state.shared += dt * LANE_SPEED;
      setTick((tick) => (tick + 1) % 1e6);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion]);

  const state = sim.current;
  const lines = LINES.map((line, i) => {
    const t = state.value[i];
    const points = line.tangled.map(([x, y], p): Point => [
      lerp(x, line.organized[p][0], t),
      lerp(y, line.organized[p][1], t),
    ]);
    const progress = ((state.position[i] % 1) + 1) % 1;
    return {
      d: toPath(points),
      pulse: (scale: number) => {
        const head = reducedMotion ? 0.5 : -0.1 + progress * 1.2;
        const length = PULSE_LENGTH * scale;
        return {
          pathLength: 1,
          strokeDasharray: `${length} 1.2`,
          strokeDashoffset: length / 2 - head,
          strokeLinecap: 'round' as const,
          fill: 'none',
          stroke: `url(#${pulseId})`,
        };
      },
    };
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative isolate h-full w-full overflow-hidden"
    >
      <div
        className="absolute top-[-56px] left-1/2 h-[230px] w-[320px] -translate-x-1/2"
        style={{
          maskImage: 'linear-gradient(to bottom, #000 62%, transparent 76%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, #000 62%, transparent 76%)',
        }}
      >
        <svg width="320" height="230" viewBox="0 0 320 230" className="block">
          <defs>
            <linearGradient
              id={`${fadeId}-ramp`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="320"
              y2="0"
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.26" stopColor="#fff" />
              <stop offset="0.74" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask
              id={fadeId}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="320"
              height="230"
            >
              <rect width="320" height="230" fill={`url(#${fadeId}-ramp)`} />
            </mask>
            <linearGradient
              id={pulseId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="320"
              y2="0"
            >
              {PULSE_COLORS.map((color, i) => (
                <stop
                  key={color}
                  offset={i / (PULSE_COLORS.length - 1)}
                  stopColor={color}
                />
              ))}
            </linearGradient>
            <filter
              id={glowId}
              filterUnits="userSpaceOnUse"
              x="-20"
              y="-20"
              width="360"
              height="270"
            >
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter
              id={softId}
              filterUnits="userSpaceOnUse"
              x="-20"
              y="-20"
              width="360"
              height="270"
            >
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>
          <g mask={`url(#${fadeId})`}>
            <g
              fill="none"
              strokeWidth="1.25"
              style={{
                stroke: organized ? LINE_COLOR_ORGANIZED : LINE_COLOR,
                transition: 'stroke 200ms ease-out',
              }}
            >
              {lines.map(({ d }, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <g filter={`url(#${glowId})`} opacity="0.5">
              {lines.map(({ d, pulse }, i) => (
                <path key={i} d={d} {...pulse(0.8)} strokeWidth="5" />
              ))}
            </g>
            <g filter={`url(#${softId})`}>
              {lines.map(({ d, pulse }, i) =>
                TRAIL_SCALES.map((scale, j) => (
                  <path
                    key={`${i}-${j}`}
                    d={d}
                    {...pulse(scale)}
                    strokeWidth="1.6"
                    opacity={TRAIL_OPACITY}
                  />
                ))
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
