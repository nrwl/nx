// #4 Ultracache, after the Oct 22 UltracacheMonitor clip, with a test task
// (tests read selectively; builds read nearly every source file). Beats:
//   1. Monitor: shop:test runs on a worker. Ultracache sits between the
//      process and the workspace and sees every file it opens, including
//      files from other projects and root config.
//   2. Record: the reads are stored in Nx Cloud as the task's inputs, the way
//      Ultracache writes them: one glob per project and file type, then a
//      `!` exclusion for what wasn't read (shape checked against Ocean runs).
//   3. Change: click a file. A change to a recorded input reruns the task, a
//      change to a file it never read is a cache hit.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';
import {
  BASE,
  CAPTION,
  Frame,
  MONO,
  PRESS,
  ReplayButton,
  SWAP_IN,
  SWAP_OUT,
  Steps,
  useC,
} from './kit';

type Phase = 'monitor' | 'record' | 'change';
const STEPS: { id: Phase; label: string }[] = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'record', label: 'Record' },
  { id: 'change', label: 'Change' },
];

const FILES = [
  {
    path: 'apps/shop/src/cart/cart.spec.tsx',
    short: 'cart.spec.tsx',
    read: true,
  },
  { path: 'apps/shop/src/cart/page.tsx', short: 'cart/page.tsx', read: true },
  {
    path: 'apps/shop/src/checkout/page.tsx',
    short: 'checkout/page.tsx',
    read: false,
  },
  { path: 'apps/shop/src/i18n/de.json', short: 'i18n/de.json', read: false },
  {
    path: 'apps/shop/eslint.config.mjs',
    short: 'eslint.config.mjs',
    read: false,
  },
  { path: 'apps/shop/README.md', short: 'README.md', read: false },
  { path: 'libs/ui/src/button.tsx', short: 'ui/button.tsx', read: true },
  { path: 'tsconfig.base.json', short: 'tsconfig.base.json', read: true },
];
/** Files in the order the test opens them. */
const READS = [7, 0, 1, 6];
const JS = '{ts,mts,cts,js,mjs,cjs,tsx,jsx}';
/** What ends up stored. `covers` lists files an entry matches; `!` entries
 * take matched files back out. de.json and README.md match nothing. */
const INPUTS: {
  path: string;
  short: string;
  covers: number[];
  not?: boolean;
}[] = [
  {
    path: `apps/shop/**/*.${JS}`,
    short: 'shop/**/*.{ts,…}',
    covers: [0, 1, 2, 4],
  },
  {
    path: '!apps/shop/src/checkout/**',
    short: '!shop/…/checkout/**',
    covers: [2],
    not: true,
  },
  {
    path: '!apps/shop/eslint.config.mjs',
    short: '!shop/eslint.config…',
    covers: [4],
    not: true,
  },
  { path: `libs/ui/src/**/*.${JS}`, short: 'ui/src/**/*.{ts,…}', covers: [6] },
  { path: 'tsconfig.base.json', short: 'tsconfig.base.json', covers: [7] },
];
/** Does a change to file `i` invalidate the task? */
const invalidates = (i: number) =>
  INPUTS.some((e) => !e.not && e.covers.includes(i)) &&
  !INPUTS.some((e) => e.not && e.covers.includes(i));

// Beat timings, seconds from the start of each phase.
const MON = {
  read: READS.map((_, k) => 0.7 + k * 0.95),
  draw: 0.4,
  hold: 0.5,
  notRead: 4.6,
  done: 4.9,
  end: 5.4,
};
const REC = {
  card: 0,
  entry: INPUTS.map((_, k) => 0.35 + k * 0.55),
  end: 0.35 + INPUTS.length * 0.55 + 0.4,
};
const HOLD_MS = 1400;
/** Changed when the figure reaches the last beat on its own. */
const DEFAULT_CHANGE = 3; // de.json

const ROW = 34;
const ROW_GAP = 8;
const MID = 96;
const CARD_H = 124;
/** Room above the cards for the Ultracache pill and the files label. */
const TOP = 52;
const fileY = (i: number) => TOP + i * (ROW + ROW_GAP) + ROW / 2;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
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

export default function Ultracache() {
  const C = useC();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.35 });
  const [phase, setPhase] = useState<Phase>('monitor');
  const [auto, setAuto] = useState(true);
  const [replays, setReplays] = useState(0);
  const [t, setT] = useState(0);
  const [changed, setChanged] = useState<number | null>(null);
  const dur = phase === 'monitor' ? MON.end : phase === 'record' ? REC.end : 0;

  useEffect(() => {
    if (!inView) return;
    if (phase === 'change') {
      setT(0);
      setChanged((c) => c ?? DEFAULT_CHANGE);
      return;
    }
    setT(reduced ? dur : 0);
    const controls = reduced
      ? null
      : animate(0, dur, { duration: dur, ease: 'linear', onUpdate: setT });
    let next: ReturnType<typeof setTimeout> | undefined;
    if (auto)
      next = setTimeout(
        () => setPhase(phase === 'monitor' ? 'record' : 'change'),
        (reduced ? 0 : dur * 1000) + HOLD_MS
      );
    return () => {
      controls?.stop();
      clearTimeout(next);
    };
  }, [inView, phase, replays, auto, reduced, dur]);

  // Monitor state: which files have been read so far, and the live read.
  const time = inView ? t : 0;
  const after = (p: Phase) =>
    STEPS.findIndex((s) => s.id === phase) > STEPS.findIndex((s) => s.id === p);
  const readSoFar = (i: number) => {
    if (after('monitor')) return FILES[i].read;
    const k = READS.indexOf(i);
    return k >= 0 && time >= MON.read[k] + MON.draw;
  };
  const live =
    phase === 'monitor'
      ? READS.findIndex(
          (_, k) =>
            time >= MON.read[k] && time < MON.read[k] + MON.draw + MON.hold
        )
      : -1;
  const liveDraw =
    live >= 0 ? Math.min(1, (time - MON.read[live]) / MON.draw) : 0;
  const showNotRead = after('monitor') || time >= MON.notRead;
  const runDone = after('monitor') || time >= MON.done;

  // Record state
  const recT = phase === 'record' ? time : after('record') ? REC.end : -1;
  const stored = {
    card: recT >= REC.card,
    count: REC.entry.filter((at) => recT >= at).length,
  };

  // Change state
  const changeOn = phase === 'change' && changed !== null;
  // every stored entry the changed file matches (globs and exclusions)
  const matched = changeOn
    ? INPUTS.flatMap((e, k) => (e.covers.includes(changed!) ? [k] : []))
    : [];
  const reruns = changeOn && invalidates(changed!);

  const pick = (i: number) => {
    setAuto(false);
    setChanged(i);
    setPhase('change');
  };

  return (
    <div ref={box}>
      <Frame
        label="Ultracache"
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
                setChanged(null);
                setPhase('monitor');
                setReplays((r) => r + 1);
              }}
            />
          </>
        }
      >
        <Scene
          C={C}
          reduced={!!reduced}
          live={live >= 0 ? READS[live] : -1}
          liveDraw={liveDraw}
          readSoFar={readSoFar}
          showNotRead={showNotRead}
          runDone={runDone}
          stored={stored}
          changed={changeOn ? changed : null}
          matched={matched}
          reruns={reruns}
          onPick={pick}
        />
      </Frame>
    </div>
  );
}

function Scene({
  C,
  reduced,
  live,
  liveDraw,
  readSoFar,
  showNotRead,
  runDone,
  stored,
  changed,
  matched,
  reruns,
  onPick,
}: {
  C: ReturnType<typeof useC>;
  reduced: boolean;
  live: number;
  liveDraw: number;
  readSoFar: (i: number) => boolean;
  showNotRead: boolean;
  runDone: boolean;
  stored: { card: boolean; count: number };
  changed: number | null;
  matched: number[];
  reruns: boolean;
  onPick: (i: number) => void;
}) {
  const { ref, w } = useWidth();
  const narrow = w < 560;
  const mid = narrow ? 36 : MID;
  const col = (w - mid) / 2;
  const lineX = col + mid / 2;
  const filesX = col + mid;
  const filesH = TOP + FILES.length * (ROW + ROW_GAP);
  const cardMid = TOP + CARD_H / 2;
  const name = (f: { path: string; short: string }) =>
    narrow ? f.short : f.path;

  // Curve from the process, through Ultracache, to a file.
  const curve = (i: number) => {
    const y = fileY(i);
    return `M${col},${cardMid} C${lineX},${cardMid} ${lineX},${y} ${filesX},${y}`;
  };
  // The recorded-input line that decides a change: the glob that matches it,
  // or the `!` exclusion that takes it back out.
  const decider =
    changed === null
      ? -1
      : (matched.find((k) => (INPUTS[k].not ? !reruns : reruns)) ?? -1);
  const recRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [deciderY, setDeciderY] = useState<number | null>(null);
  useLayoutEffect(() => {
    const card = recRef.current;
    const row = decider >= 0 ? rowRefs.current[decider] : null;
    setDeciderY(
      card && row ? card.offsetTop + row.offsetTop + row.offsetHeight / 2 : null
    );
  }, [decider, w, stored.count]);
  // Changed file to the line that decides, across the Ultracache line.
  const changedCurve =
    changed !== null && deciderY !== null
      ? `M${filesX},${fileY(changed)} C${lineX},${fileY(changed)} ${lineX},${deciderY} ${col},${deciderY}`
      : null;
  const verdict =
    changed === null
      ? null
      : reruns
        ? {
            title: 'Reruns',
            why: `${FILES[changed].short} matches a recorded input`,
            color: C.primaryText,
            bg: C.primaryBg,
            border: C.primary,
          }
        : decider >= 0
          ? {
              title: 'Cache hit',
              why: `${FILES[changed].short} is excluded, the test never read it`,
              color: C.success,
              bg: C.successBg,
              border: C.successFill,
            }
          : {
              title: 'Cache hit',
              why: `${FILES[changed].short} is not a recorded input`,
              color: C.success,
              bg: C.successBg,
              border: C.successFill,
            };

  const status =
    changed !== null
      ? reruns
        ? { text: 'runs', color: C.primaryText, bg: C.primaryBg }
        : { text: 'cache hit', color: C.success, bg: C.successBg }
      : runDone
        ? { text: 'run done', color: C.success, bg: C.successBg }
        : { text: 'monitored', color: C.cloudText, bg: 'transparent' };

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: Math.max(filesH, TOP + 372) + 8 }}
    >
      {/* Ultracache, between the process and the workspace */}
      <div
        className="absolute top-[26px] bottom-0 border-l border-dashed"
        style={{ left: lineX, borderColor: C.cloud }}
      />
      <div
        className="absolute top-0 -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold"
        style={{
          left: lineX,
          borderColor: C.cloud,
          color: C.cloudText,
          background: C.surface,
        }}
      >
        Ultracache
      </div>

      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={w}
        height={filesH}
      >
        {live >= 0 && (
          <>
            <path
              d={curve(live)}
              fill="none"
              stroke={C.primary}
              strokeWidth={2}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - liveDraw}
            />
            <circle
              cx={lineX}
              cy={(cardMid + fileY(live)) / 2}
              r={5}
              fill={C.surface}
              stroke={C.cloud}
              strokeWidth={2}
            />
          </>
        )}
        {changedCurve && verdict && (
          <motion.path
            key={`chg-${changed}`}
            d={changedCurve}
            fill="none"
            stroke={verdict.border}
            strokeWidth={2}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          />
        )}
      </svg>

      {/* the process */}
      <div
        className="absolute left-0 overflow-hidden rounded-[10px] border p-3 transition-colors duration-200"
        style={{
          top: TOP,
          width: col,
          height: CARD_H,
          borderColor: verdict ? verdict.border : runDone ? C.border : C.cloud,
          borderWidth: verdict ? 2 : 1,
          background: verdict ? verdict.bg : C.surface,
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {verdict ? (
            <motion.div
              key={`verdict-${changed}`}
              initial={{ opacity: 0, y: reduced ? 0 : 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, transition: SWAP_OUT }}
              transition={SWAP_IN}
            >
              <div className={`${MONO} text-[12px] text-(--fig-fg2)`}>
                shop:test
              </div>
              <div
                className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.015em]"
                style={{ color: verdict.color }}
              >
                {verdict.title}
              </div>
              <div className="mt-1 text-[13px] leading-snug text-(--fig-fg2)">
                {verdict.why}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="process"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: SWAP_OUT }}
              transition={SWAP_IN}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                <span className="text-[12px] text-(--fig-muted)">
                  {narrow ? 'On worker 1' : 'Process on worker 1'}
                </span>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={status.text}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium"
                    style={{ color: status.color, background: status.bg }}
                    initial={{
                      opacity: 0,
                      y: reduced ? 0 : 4,
                      filter: 'blur(2px)',
                    }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{
                      opacity: 0,
                      y: reduced ? 0 : -4,
                      filter: 'blur(6px)',
                      transition: SWAP_OUT,
                    }}
                    transition={SWAP_IN}
                  >
                    {status.text === 'monitored' && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: C.cloud }}
                      />
                    )}
                    {status.text}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className={`${MONO} mt-1 text-[17px] text-(--fig-fg)`}>
                shop:test
              </div>
              {!narrow && (
                <div
                  className={`${MONO} mt-1.5 text-[11px] leading-[1.45] text-(--fig-muted)`}
                >
                  vitest run
                  <br />└ src/cart/cart.spec.tsx
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* recorded inputs, stored in Nx Cloud */}
      <motion.div
        ref={recRef}
        className="absolute left-0 rounded-[10px] border p-3"
        style={{
          top: TOP + CARD_H + 14,
          width: col,
          borderColor: C.cloud,
          background: C.primaryWash,
        }}
        initial={false}
        animate={{
          opacity: stored.card ? 1 : 0,
          y: stored.card || reduced ? 0 : 6,
        }}
        transition={BASE}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span
            className={`${CAPTION} font-semibold`}
            style={{ color: C.cloudText }}
          >
            Recorded inputs
          </span>
          {!narrow && (
            <span className="text-[11px] text-(--fig-muted)">
              stored in Nx Cloud
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {INPUTS.slice(0, stored.count).map((e, k) => {
              // Light up the entry that decides: the glob when the change
              // reruns the task, the `!` exclusion when it doesn't.
              const decides = matched.includes(k) && (e.not ? !reruns : reruns);
              const tone = !decides
                ? {
                    border: C.border,
                    bg: C.surface,
                    text: e.not ? C.fg2 : C.fg,
                  }
                : e.not
                  ? { border: C.successFill, bg: C.successBg, text: C.success }
                  : { border: C.primary, bg: C.primaryBg, text: C.primaryText };
              return (
                <motion.div
                  key={e.path}
                  ref={(el) => {
                    rowRefs.current[k] = el;
                  }}
                  layout={!reduced}
                  className={`${MONO} truncate rounded-md border px-2 py-1 text-[12px] transition-colors duration-200`}
                  style={{
                    borderColor: tone.border,
                    background: tone.bg,
                    color: tone.text,
                  }}
                  initial={{ opacity: 0, x: reduced ? 0 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, transition: SWAP_OUT }}
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                >
                  {narrow ? e.short : e.path}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* the workspace */}
      <div
        className={`${CAPTION} absolute text-(--fig-muted)`}
        style={{ left: filesX, top: TOP - 24 }}
      >
        Workspace files
      </div>
      {FILES.map((f, i) => {
        const read = readSoFar(i);
        const notRead = !f.read && showNotRead;
        const isChanged = changed === i;
        const isLive = live === i;
        const tone = isChanged
          ? { bg: C.dangerBg, border: C.dangerFill, text: C.danger }
          : read
            ? {
                bg: C.primaryBg,
                border: isLive ? C.primary : C.primarySoft,
                text: C.primaryText,
              }
            : {
                bg: C.inset,
                border: C.border,
                text: notRead ? C.muted : C.fg2,
              };
        return (
          <button
            key={f.path}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Change ${f.path}`}
            className={`absolute flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 text-left transition-colors duration-200 hover:brightness-[0.98] ${PRESS}`}
            style={{
              left: filesX,
              width: w - filesX,
              top: fileY(i) - ROW / 2,
              height: ROW,
              background: tone.bg,
              borderColor: tone.border,
              color: tone.text,
              // focus the change: the other files step back
              opacity: changed !== null && !isChanged ? 0.45 : 1,
              transitionProperty:
                'background-color, border-color, color, opacity',
            }}
          >
            <span className={`${MONO} truncate text-[12px]`}>{name(f)}</span>
            <span className="shrink-0 text-[11px] font-medium">
              {narrow && !isChanged
                ? ''
                : isChanged
                  ? 'changed'
                  : read
                    ? 'read'
                    : notRead
                      ? 'not read'
                      : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
