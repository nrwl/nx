// Task-based affected, same workspace as the
// "Task-based affected in Nx" clip (video-animations nx-task-affected).
// Inputs follow the Nx defaults the clip uses: build reads `production`
// (no spec files) and `^production`; test reads `default` and `^production`;
// e2e reads `^production`. Lint is modeled as plain lint: its own files only.
// (The @nx/eslint plugin also infers `^default` for type-aware and
// module-boundary rules; left out here to keep the example about inputs.)
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BASE, Frame, INSTANT, Segmented, Stat, TAP, useC } from './kit';

type Target = 'build' | 'test' | 'lint' | 'e2e';
type Input = 'production' | 'default';

const NODES: { id: string; x: number; y: number; targets: Target[] }[] = [
  { id: 'app-e2e', x: 24, y: 9, targets: ['e2e', 'lint'] },
  { id: 'admin-e2e', x: 76, y: 9, targets: ['e2e', 'lint'] },
  { id: 'app', x: 24, y: 36, targets: ['build', 'test', 'lint'] },
  { id: 'admin', x: 76, y: 36, targets: ['build', 'test', 'lint'] },
  { id: 'data', x: 24, y: 63, targets: ['build', 'test', 'lint'] },
  { id: 'ui', x: 76, y: 63, targets: ['build', 'test', 'lint'] },
  { id: 'utils', x: 50, y: 90, targets: ['build', 'test', 'lint'] },
];

/** [dependent, dependency] */
const EDGES: [string, string][] = [
  ['app-e2e', 'app'],
  ['admin-e2e', 'admin'],
  ['app', 'data'],
  ['app', 'ui'],
  ['admin', 'ui'],
  ['data', 'utils'],
  ['ui', 'utils'],
];

const INPUTS: Record<Target, { own: Input; deps: Input | null }> = {
  build: { own: 'production', deps: 'production' },
  test: { own: 'default', deps: 'production' },
  lint: { own: 'default', deps: null },
  e2e: { own: 'default', deps: 'production' },
};

const FILES = {
  spec: { label: 'ui/button.spec.ts', project: 'ui', kind: 'spec' as const },
  source: { label: 'ui/button.tsx', project: 'ui', kind: 'source' as const },
};
type FileKey = keyof typeof FILES;

/** Hops from `from` up to each transitive dependent. */
function dependents(from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dep, on] of EDGES) {
      if (on === cur && !dist.has(dep)) {
        dist.set(dep, dist.get(cur)! + 1);
        queue.push(dep);
      }
    }
  }
  return dist;
}

const covers = (input: Input, kind: 'spec' | 'source') =>
  input === 'default' || kind === 'source';

interface TaskState {
  affected: boolean;
  hop: number;
  why: string;
}

function evaluate(fileKey: FileKey) {
  const file = FILES[fileKey];
  const dist = dependents(file.project);
  const states = new Map<string, TaskState>();
  for (const n of NODES) {
    for (const t of n.targets) {
      const id = `${n.id}:${t}`;
      const hop = dist.get(n.id);
      if (hop === undefined) {
        states.set(id, {
          affected: false,
          hop: 0,
          why: `${n.id} doesn't depend on ${file.project}, so nothing ${id} reads has changed.`,
        });
        continue;
      }
      const own = hop === 0;
      const input = own ? INPUTS[t].own : INPUTS[t].deps;
      if (input === null) {
        states.set(id, {
          affected: false,
          hop,
          why: `${id} reads only ${n.id}'s own files, nothing from ${file.project}. Not affected.`,
        });
        continue;
      }
      const named = own ? input : `^${input}`;
      const hit = covers(input, file.kind);
      states.set(id, {
        affected: hit,
        hop,
        why: hit
          ? `${id} reads ${named}${own ? '' : ` from ${file.project}`}, which includes ${file.label.split('/').pop()}. Affected.`
          : `${id} reads ${named}${own ? '' : ` from ${file.project}`}, which leaves out spec files. Not affected.`,
      });
    }
  }
  return states;
}

const TOTAL = NODES.reduce((s, n) => s + n.targets.length, 0);
const HOP_DELAY = 0.35;

export default function TaskAffected() {
  const C = useC();
  const [fileKey, setFileKey] = useState<FileKey>('spec');
  const [picked, setPicked] = useState<string>('ui:build');
  const states = useMemo(() => evaluate(fileKey), [fileKey]);
  const count = [...states.values()].filter((s) => s.affected).length;
  const run = fileKey;
  const owner = FILES[fileKey].project;
  const pickedState = states.get(picked);

  const projectLit = (id: string) =>
    NODES.find((n) => n.id === id)!.targets.some(
      (t) => states.get(`${id}:${t}`)?.affected
    );

  return (
    <Frame
      label="Task-based affected"
      controls={
        <Segmented
          value={fileKey}
          onChange={setFileKey}
          options={(Object.keys(FILES) as FileKey[]).map((k) => ({
            value: k,
            label: FILES[k].label.split('/').pop()!,
          }))}
        />
      }
      footer={
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Stat
            label="Tasks to run"
            value={`${count} of ${TOTAL}`}
            tone="good"
          />
          <p className="max-w-md min-w-0 flex-1 text-xs leading-relaxed text-(--fig-fg2)">
            <span className="font-['Server_Mono',ui-monospace,monospace] text-(--fig-fg)">
              {picked}
            </span>{' '}
            {pickedState?.why.replace(`${picked} `, '')}
            <span className="block pt-1 text-(--fig-muted)">
              Tap any task to see why.
            </span>
          </p>
        </div>
      }
    >
      <div className="relative mx-auto h-[400px] w-full max-w-[640px] sm:h-[440px]">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {EDGES.map(([a, b]) => {
            const A = NODES.find((n) => n.id === a)!;
            const B = NODES.find((n) => n.id === b)!;
            const lit = projectLit(a) && projectLit(b);
            return (
              <motion.line
                key={`${run}-${a}-${b}`}
                x1={A.x}
                y1={A.y + 7}
                x2={B.x}
                y2={B.y - 7}
                vectorEffect="non-scaling-stroke"
                initial={{ stroke: C.edge }}
                animate={{ stroke: lit ? C.primary : C.edge }}
                // Lighting up follows the change hop by hop; going dark is
                // the answer to a click, so it happens at once.
                transition={
                  lit
                    ? {
                        delay:
                          (states.get(
                            `${a}:${NODES.find((n) => n.id === a)!.targets[0]}`
                          )?.hop ?? 0) * HOP_DELAY,
                        ...BASE,
                      }
                    : INSTANT
                }
                strokeWidth={lit ? 2 : 1.25}
              />
            );
          })}
        </svg>
        {NODES.map((n) => (
          <div
            key={n.id}
            className="absolute w-[44%] max-w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-(--fig-border) bg-(--fig-surface) px-2.5 py-2"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="truncate font-['Server_Mono',ui-monospace,monospace] text-xs font-semibold text-(--fig-fg)">
                {n.id}
              </span>
              {n.id === owner && (
                <span
                  title="modified"
                  className="shrink-0 rounded-md px-1.5 text-[11px] font-semibold"
                  style={{ background: C.warningFill, color: C.ink }}
                >
                  M
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {n.targets.map((t) => {
                const id = `${n.id}:${t}`;
                const s = states.get(id)!;
                return (
                  <motion.button
                    key={`${run}-${id}`}
                    type="button"
                    onClick={() => setPicked(id)}
                    whileTap={TAP}
                    className={`cursor-pointer rounded-md px-1.5 py-0.5 font-['Server_Mono',ui-monospace,monospace] text-[10px] ${
                      picked === id
                        ? 'ring-2 ring-(--fig-fg2) ring-offset-1 ring-offset-(--fig-surface)'
                        : ''
                    }`}
                    initial={{
                      backgroundColor: C.ghost,
                      color: C.muted,
                    }}
                    animate={
                      s.affected
                        ? { backgroundColor: C.primary, color: C.onFill }
                        : {
                            backgroundColor: C.ghost,
                            color: C.muted,
                          }
                    }
                    transition={
                      s.affected
                        ? {
                            delay: s.hop * HOP_DELAY,
                            ...BASE,
                          }
                        : INSTANT
                    }
                  >
                    {t}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
