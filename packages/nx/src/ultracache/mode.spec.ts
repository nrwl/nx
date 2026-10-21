import {
  resolveTaskUltracacheModes,
  resolveUltracacheMode,
  ultracacheModeOverride,
  type UltracacheMode,
} from './mode';
import type { Task } from '../config/task-graph';
import { pruneTaskGraph } from '../tasks-runner/prune-task-graph';

const modes: UltracacheMode[] = ['on', 'warn', 'error', 'off'];

describe('Ultracache mode precedence', () => {
  it.each(modes)(
    'uses workspace %s only when a target mode is absent',
    (defaultMode) => {
      expect(resolveUltracacheMode(undefined, defaultMode, undefined)).toBe(
        defaultMode
      );
      expect(
        resolveUltracacheMode(
          { ignoreReads: ['tmp/**'] },
          defaultMode,
          undefined
        )
      ).toBe(defaultMode);
      for (const mode of modes) {
        expect(resolveUltracacheMode({ mode }, defaultMode, undefined)).toBe(
          mode
        );
        for (const override of modes) {
          expect(resolveUltracacheMode({ mode }, defaultMode, override)).toBe(
            override
          );
        }
      }
    }
  );

  it.each(['', 'ON', 'true', 'false', 'warning', ' on '])(
    'rejects invalid environment value %j',
    (value) => {
      expect(() =>
        ultracacheModeOverride({ NX_CLOUD_ULTRACACHE_MODE: value })
      ).toThrow('NX_CLOUD_ULTRACACHE_MODE must be one of on, warn, error, off');
    }
  );

  it('accepts exactly the four modes and distinguishes an unset override', () => {
    expect(ultracacheModeOverride({})).toBeUndefined();
    for (const mode of modes) {
      expect(ultracacheModeOverride({ NX_CLOUD_ULTRACACHE_MODE: mode })).toBe(
        mode
      );
    }
  });

  it.each(modes)(
    'resolves every task to env %s and preserves authored settings',
    (override) => {
      const settings = { mode: 'off' as const, ignoreReads: ['tmp/**'] };
      const tasks = [
        { id: 'a:build', cache: true, ultracache: settings },
        { id: 'b:build', cache: true, ultracache: { mode: 'on' } },
        { id: 'c:serve', continuous: true },
        { id: 'd:uncached', cache: false },
      ] as Task[];
      resolveTaskUltracacheModes(tasks, 'warn', override);
      expect(tasks.map((t) => t.ultracache.mode)).toEqual(
        tasks.map(() => override)
      );
      expect(tasks[0].ultracache.ignoreReads).toEqual(['tmp/**']);
      expect(settings.mode).toBe('off');
      const graph = pruneTaskGraph({
        roots: [],
        tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
        dependencies: {},
        continuousDependencies: {},
      });
      const received = JSON.parse(JSON.stringify(graph));
      resolveTaskUltracacheModes(
        Object.values(received.tasks),
        'error',
        override === 'on' ? 'off' : 'on',
        true
      );
      expect(
        Object.values(received.tasks).map((t: Task) => t.ultracache.mode)
      ).toEqual(tasks.map(() => override));
    }
  );

  it('fills missing modes on legacy agent tasks while preserving server modes', () => {
    const tasks: Pick<Task, 'ultracache'>[] = [
      { ultracache: { mode: 'on' } },
      {},
      { ultracache: { ignoreWrites: ['tmp/**'] } },
    ];
    resolveTaskUltracacheModes(tasks, 'warn', undefined, true);
    expect(tasks.map((t) => t.ultracache.mode)).toEqual(['on', 'warn', 'warn']);
  });
});
