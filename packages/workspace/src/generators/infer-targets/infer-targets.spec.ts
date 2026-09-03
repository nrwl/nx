import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { output, type Tree } from '@nx/devkit';
import { NoTargetsToMigrateError } from '@nx/devkit/internal';
import type { BatchConversionSession } from '@nx/devkit/internal';
import { convertToInferredGenerator } from './infer-targets';

// The session/finalize semantics (deferred staging, the combined verification
// pass, failure containment) are covered by the devkit specs; here only the
// wiring is pinned: which conversions run inside the batch session, when the
// finalize runs, and when the queued generator callbacks run.
const events: string[] = [];
const openedSessions: BatchConversionSession[] = [];
const finalizeCalls: { tree: Tree; session: BatchConversionSession }[] = [];
// Replaces the delegate-to-real default so a test can model a finalize whose
// internal failure was downgraded to a warning (the real contract).
let finalizeOverride: (() => Promise<void>) | undefined;
const mockGeneratorImpls: Record<
  string,
  (tree: Tree, options: unknown) => Promise<unknown>
> = {};

jest.mock('@nx/devkit/internal', () => {
  const actual = jest.requireActual('@nx/devkit/internal');
  return {
    ...actual,
    findInstalledPlugins: () => [
      { name: '@nx/a' },
      { name: '@nx/b' },
      { name: '@nx/c' },
    ],
    getGeneratorInformation: (collectionName: string) => ({
      resolvedCollectionName: collectionName,
      generatorConfiguration: { hidden: false },
      implementationFactory: () => mockGeneratorImpls[collectionName],
    }),
    openBatchConversionSession: (tree: Tree) => {
      const session = actual.openBatchConversionSession(tree);
      openedSessions.push(session);
      const runChild = session.runChild.bind(session);
      session.runChild = (async (fn: () => unknown) => {
        events.push('runChild:start');
        try {
          return await runChild(fn);
        } finally {
          events.push('runChild:end');
        }
      }) as typeof session.runChild;
      const close = session.close.bind(session);
      session.close = () => {
        events.push('close');
        close();
      };
      return session;
    },
    finalizeBatchConversion: async (
      tree: Tree,
      session: BatchConversionSession
    ) => {
      events.push('finalize');
      finalizeCalls.push({ tree, session });
      if (finalizeOverride) {
        return finalizeOverride();
      }
      return actual.finalizeBatchConversion(tree, session);
    },
  };
});

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: async () => ({ nodes: {}, dependencies: {} }),
}));

describe('convertToInferredGenerator', () => {
  let tree: Tree;

  const registerConversion = (
    collection: string,
    impl?: (tree: Tree, options: unknown) => Promise<unknown>
  ) => {
    mockGeneratorImpls[collection] = jest.fn(async (t, options) => {
      events.push(`child:${collection}`);
      if (impl) {
        return impl(t, options);
      }
      return () => {
        events.push(`callback:${collection}`);
      };
    });
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    events.length = 0;
    openedSessions.length = 0;
    finalizeCalls.length = 0;
    finalizeOverride = undefined;
    for (const collection of ['@nx/a', '@nx/b', '@nx/c']) {
      registerConversion(collection);
    }
  });

  it('runs every conversion of a multi-plugin batch inside one session, finalizes it, and only then runs the queued callbacks', async () => {
    const callback = await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });

    // every child ran inside session.runChild, the finalize consumed the same
    // session after the loop, and no conversion callback ran yet
    expect(events).toEqual([
      'runChild:start',
      'child:@nx/a',
      'runChild:end',
      'runChild:start',
      'child:@nx/b',
      'runChild:end',
      'runChild:start',
      'child:@nx/c',
      'runChild:end',
      'finalize',
      'close',
    ]);
    expect(openedSessions).toHaveLength(1);
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0].tree).toBe(tree);
    expect(finalizeCalls[0].session).toBe(openedSessions[0]);

    await callback();
    expect(events.slice(-3)).toEqual([
      'callback:@nx/a',
      'callback:@nx/b',
      'callback:@nx/c',
    ]);
  });

  it('does not open a session for a single selected plugin and still queues its callback', async () => {
    registerConversion('@nx/b', async () => () => {
      events.push('callback:@nx/b');
      // a callback returning a function queues that task too
      return () => events.push('inner:@nx/b');
    });

    const callback = await convertToInferredGenerator(tree, {
      plugins: ['@nx/b'],
      skipFormat: true,
    });

    expect(openedSessions).toHaveLength(0);
    expect(events).toEqual(['child:@nx/b']);

    await callback();
    expect(events).toEqual(['child:@nx/b', 'callback:@nx/b', 'inner:@nx/b']);
  });

  it('runs the queued callbacks exactly once when a child has no targets and the finalize fails internally', async () => {
    registerConversion('@nx/b', async () => {
      throw new NoTargetsToMigrateError();
    });
    // the real finalize never throws: an internal failure is downgraded to a
    // warning, so the callback queue must run unchanged after it resolves
    finalizeOverride = async () => {
      events.push('finalize:internal-failure');
    };

    const callback = await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });
    await callback();

    expect(events).toEqual([
      'runChild:start',
      'child:@nx/a',
      'runChild:end',
      'runChild:start',
      'child:@nx/b',
      'runChild:end',
      'runChild:start',
      'child:@nx/c',
      'runChild:end',
      'finalize',
      'finalize:internal-failure',
      'close',
      'callback:@nx/a',
      'callback:@nx/c',
    ]);
  });

  it('finalizes the batch when the final child has no targets to migrate', async () => {
    // guards against gating the finalize on the final child's success: the
    // earlier children's committed plans must still centralize
    registerConversion('@nx/c', async () => {
      throw new NoTargetsToMigrateError();
    });

    const callback = await convertToInferredGenerator(tree, {
      plugins: ['@nx/a', '@nx/b', '@nx/c'],
      skipFormat: true,
    });
    await callback();

    expect(events).toEqual([
      'runChild:start',
      'child:@nx/a',
      'runChild:end',
      'runChild:start',
      'child:@nx/b',
      'runChild:end',
      'runChild:start',
      'child:@nx/c',
      'runChild:end',
      'finalize',
      'close',
      'callback:@nx/a',
      'callback:@nx/b',
    ]);
    expect(finalizeCalls).toHaveLength(1);
    expect(finalizeCalls[0].session).toBe(openedSessions[0]);
  });

  it('closes the session without finalizing when a conversion fails fatally', async () => {
    registerConversion('@nx/b', async () => {
      throw new Error('boom');
    });

    await expect(
      convertToInferredGenerator(tree, {
        plugins: ['@nx/a', '@nx/b', '@nx/c'],
        skipFormat: true,
      })
    ).rejects.toThrow('boom');

    expect(events).toEqual([
      'runChild:start',
      'child:@nx/a',
      'runChild:end',
      'runChild:start',
      'child:@nx/b',
      'runChild:end',
      'close',
    ]);
    expect(finalizeCalls).toHaveLength(0);
  });

  it('reports the failing conversion when its deferred callback throws', async () => {
    // The success line for a conversion prints before its callback runs, so a
    // callback failure must name the conversion it belongs to.
    registerConversion('@nx/b', async () => () => {
      throw new Error('boom');
    });
    const error = jest.spyOn(output, 'error').mockImplementation(() => {});

    try {
      const runTasks = await convertToInferredGenerator(tree, {
        plugins: ['@nx/a', '@nx/b', '@nx/c'],
        skipFormat: true,
      });

      await expect(runTasks()).rejects.toThrow('boom');
      expect(error).toHaveBeenCalledWith({
        title: '@nx/b:convert-to-inferred - Failed',
      });
    } finally {
      error.mockRestore();
    }
  });
});
