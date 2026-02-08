import { PluginLifecycleManager } from './plugin-lifecycle-manager';

describe('PluginLifecycleManager', () => {
  describe('constructor with empty hooks', () => {
    it('should handle empty registered hooks', () => {
      const lifecycle = new PluginLifecycleManager([]);

      expect((lifecycle as any).registeredPhaseOrder).toMatchInlineSnapshot(
        `[]`
      );
      expect(lifecycle.shouldShutdownImmediately()).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should identify registered phases for single-hook plugin', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect((lifecycle as any).registeredPhaseOrder).toMatchInlineSnapshot(`
        [
          "graph",
        ]
      `);
    });

    it('should identify registered phases for multi-hook plugin', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'createDependencies',
        'createMetadata',
      ]);

      expect((lifecycle as any).registeredPhaseOrder).toMatchInlineSnapshot(`
        [
          "graph",
        ]
      `);
    });

    it('should handle plugins with hooks in multiple phases', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'preTasksExecution',
        'postTasksExecution',
      ]);

      expect((lifecycle as any).registeredPhaseOrder).toMatchInlineSnapshot(`
        [
          "graph",
          "pre-task",
          "post-task",
        ]
      `);
    });
  });

  describe('isLastRegisteredPhase', () => {
    it('should return true if no later phases have hooks', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect(lifecycle.isLastRegisteredPhase('graph')).toBe(true);
    });

    it('should return false if later phases have hooks', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'preTasksExecution',
        'postTasksExecution',
      ]);

      expect(lifecycle.isLastRegisteredPhase('graph')).toBe(false);
      expect(lifecycle.isLastRegisteredPhase('pre-task')).toBe(false);
      expect(lifecycle.isLastRegisteredPhase('post-task')).toBe(true);
    });

    it('should handle non-contiguous phases', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'postTasksExecution',
      ]);

      // graph has post-task after it
      expect(lifecycle.isLastRegisteredPhase('graph')).toBe(false);
      // post-task has nothing after it
      expect(lifecycle.isLastRegisteredPhase('post-task')).toBe(true);
    });
  });

  describe('enterHook / exitHook', () => {
    it('should increment session count when entering first hook of phase', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);
    });

    it('should not increment session count when entering non-first hook of phase', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'createDependencies',
      ]);

      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);

      lifecycle.enterHook('createDependencies');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1); // Still 1 - not first hook
    });

    it('should decrement and return true when exiting last hook with no later phases', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);

      const shouldShutdown = lifecycle.exitHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
      expect(shouldShutdown).toBe(true);
    });

    it('should return false when exiting non-last hook', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'createDependencies',
      ]);

      lifecycle.enterHook('createNodes');
      const shouldShutdown = lifecycle.exitHook('createNodes');

      expect(shouldShutdown).toBe(false);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1); // Not decremented
    });

    it('should return false when exiting last hook but later phases have hooks', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'postTasksExecution',
      ]);

      lifecycle.enterHook('createNodes');
      const shouldShutdown = lifecycle.exitHook('createNodes');

      expect(shouldShutdown).toBe(false); // postTasksExecution is in a later phase
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
    });

    it('should return false when exiting last hook but session count > 0', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      // Two concurrent callers enter
      lifecycle.enterHook('createNodes');
      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(2);

      // First caller exits
      const shouldShutdown = lifecycle.exitHook('createNodes');
      expect(shouldShutdown).toBe(false); // session count is still 1
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);
    });

    it('should return true when last concurrent caller exits', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      // Two concurrent callers enter
      lifecycle.enterHook('createNodes');
      lifecycle.enterHook('createNodes');

      // First caller exits
      lifecycle.exitHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);

      // Second caller exits
      const shouldShutdown = lifecycle.exitHook('createNodes');
      expect(shouldShutdown).toBe(true);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
    });
  });

  describe('multi-hook phase with concurrent callers', () => {
    it('should handle A and B going through full graph phase', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'createDependencies',
        'createMetadata',
      ]);

      // A enters graph phase (createNodes is first hook)
      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);

      // B enters graph phase (createNodes is first hook)
      lifecycle.enterHook('createNodes');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(2);

      // A continues (createDependencies is not first, no session count change)
      lifecycle.enterHook('createDependencies');
      expect(lifecycle.getPhaseRefCount('graph')).toBe(2);

      // A exits createNodes (not last hook, no change)
      expect(lifecycle.exitHook('createNodes')).toBe(false);

      // B exits createNodes (not last hook, no change)
      expect(lifecycle.exitHook('createNodes')).toBe(false);

      // B continues
      lifecycle.enterHook('createDependencies');

      // A exits createDependencies (not last hook)
      expect(lifecycle.exitHook('createDependencies')).toBe(false);

      // B exits createDependencies (not last hook)
      expect(lifecycle.exitHook('createDependencies')).toBe(false);

      // A enters last hook
      lifecycle.enterHook('createMetadata');

      // B enters last hook
      lifecycle.enterHook('createMetadata');

      // A exits last hook (session count decrements to 1)
      expect(lifecycle.exitHook('createMetadata')).toBe(false);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(1);

      // B exits last hook (session count decrements to 0, no later phases)
      expect(lifecycle.exitHook('createMetadata')).toBe(true);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
    });
  });

  describe('shouldShutdownImmediately', () => {
    it('should return true if only post-task hooks', () => {
      const lifecycle = new PluginLifecycleManager(['postTasksExecution']);

      expect(lifecycle.shouldShutdownImmediately()).toBe(true);
    });

    it('should return true if only pre-task hooks (no graph hooks)', () => {
      const lifecycle = new PluginLifecycleManager(['preTasksExecution']);

      expect(lifecycle.shouldShutdownImmediately()).toBe(true);
    });

    it('should return true if pre-task and post-task hooks but no graph hooks', () => {
      const lifecycle = new PluginLifecycleManager([
        'preTasksExecution',
        'postTasksExecution',
      ]);

      expect(lifecycle.shouldShutdownImmediately()).toBe(true);
    });

    it('should return false if graph phase has hooks', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect(lifecycle.shouldShutdownImmediately()).toBe(false);
    });

    it('should return false if graph and task hooks exist', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'postTasksExecution',
      ]);

      expect(lifecycle.shouldShutdownImmediately()).toBe(false);
    });
  });

  describe('cross-phase scenarios', () => {
    it('should handle graph -> pre-task -> post-task flow', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'preTasksExecution',
        'postTasksExecution',
      ]);

      // Graph phase
      lifecycle.enterHook('createNodes');
      expect(lifecycle.exitHook('createNodes')).toBe(false); // has later phases

      // Pre-task phase
      lifecycle.enterHook('preTasksExecution');
      expect(lifecycle.exitHook('preTasksExecution')).toBe(false); // has post-task

      // Post-task phase
      lifecycle.enterHook('postTasksExecution');
      expect(lifecycle.exitHook('postTasksExecution')).toBe(true); // no later phases
    });

    it('should allow shutdown after graph phase if no task hooks', () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'createMetadata',
      ]);

      lifecycle.enterHook('createNodes');
      // createNodes is not the last hook in the phase, so no decrement
      expect(lifecycle.exitHook('createNodes')).toBe(false);

      lifecycle.enterHook('createMetadata');
      // createMetadata IS the last hook, decrement and check shutdown
      expect(lifecycle.exitHook('createMetadata')).toBe(true); // no later phases
    });
  });

  describe('error handling', () => {
    it('should throw when entering hook from unregistered phase', () => {
      // Only graph phase is registered, pre-task is not
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect(() => lifecycle.enterHook('preTasksExecution')).toThrow(
        /not registered for this plugin/
      );
    });

    it('should throw when exiting hook from unregistered phase', () => {
      // Only graph phase is registered, post-task is not
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect(() => lifecycle.exitHook('postTasksExecution')).toThrow(
        /not registered for this plugin/
      );
    });

    it('should throw when exiting with no active sessions', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      // Exit without entering
      expect(() => lifecycle.exitHook('createNodes')).toThrow(
        /No active sessions/
      );
    });

    it('should throw when checking isLastRegisteredPhase for unregistered phase', () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      expect(() => lifecycle.isLastRegisteredPhase('pre-task')).toThrow(
        /not registered for this plugin/
      );
    });

    it('should throw when entering unregistered hook even if phase is active', () => {
      // createNodes makes graph phase active, but createDependencies isn't registered
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      // Should throw - only registered hooks can be used
      expect(() => lifecycle.enterHook('createDependencies')).toThrow(
        /not registered for this plugin/
      );
    });
  });

  describe('wrapHook', () => {
    it('should call enterHook before and exitHook after the wrapped function', async () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);
      const callOrder: string[] = [];

      const wrapped = lifecycle.wrapHook(
        'createNodes',
        async () => {
          callOrder.push('fn');
          expect(lifecycle.getPhaseRefCount('graph')).toBe(1);
          return 'result';
        },
        () => {
          callOrder.push('shutdown');
        }
      );

      const result = await wrapped();

      expect(result).toBe('result');
      expect(callOrder).toEqual(['fn', 'shutdown']);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
    });

    it('should call shutdown only when exitHook returns true', async () => {
      const lifecycle = new PluginLifecycleManager([
        'createNodes',
        'postTasksExecution',
      ]);
      let shutdownCalled = false;

      const wrapped = lifecycle.wrapHook(
        'createNodes',
        async () => 'result',
        () => {
          shutdownCalled = true;
        }
      );

      await wrapped();

      // Should not shutdown because postTasksExecution is in a later phase
      expect(shutdownCalled).toBe(false);
    });

    it('should call exitHook even when wrapped function throws', async () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);
      let shutdownCalled = false;

      const wrapped = lifecycle.wrapHook(
        'createNodes',
        async () => {
          throw new Error('test error');
        },
        () => {
          shutdownCalled = true;
        }
      );

      await expect(wrapped()).rejects.toThrow('test error');
      expect(shutdownCalled).toBe(true);
      expect(lifecycle.getPhaseRefCount('graph')).toBe(0);
    });

    it('should pass arguments through to wrapped function', async () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);

      const wrapped = lifecycle.wrapHook(
        'createNodes',
        async (a: number, b: string) => `${a}-${b}`,
        () => {}
      );

      const result = await wrapped(42, 'test');
      expect(result).toBe('42-test');
    });

    it('should handle concurrent calls correctly', async () => {
      const lifecycle = new PluginLifecycleManager(['createNodes']);
      const shutdownCalls: number[] = [];
      let callCount = 0;

      const wrapped = lifecycle.wrapHook(
        'createNodes',
        async () => {
          const myCall = ++callCount;
          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          return myCall;
        },
        () => {
          shutdownCalls.push(lifecycle.getPhaseRefCount('graph'));
        }
      );

      // Start two concurrent calls
      const [result1, result2] = await Promise.all([wrapped(), wrapped()]);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      // Shutdown should only be called once, when the last caller exits
      expect(shutdownCalls).toEqual([0]);
    });
  });
});
