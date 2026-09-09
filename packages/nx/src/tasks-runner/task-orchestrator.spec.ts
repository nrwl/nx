import { TaskOrchestrator } from './task-orchestrator';

describe('TaskOrchestrator', () => {
  describe('process listener lifecycle', () => {
    it('should remove on dispose() every process listener registered by setupSignalHandlers', async () => {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.signalHandlers = [];
      orchestrator.forkedProcessTaskRunner = {
        cleanup: jest.fn(async () => {}),
        removeProcessEventListeners: jest.fn(),
      };
      const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
      const before = Object.fromEntries(
        signals.map((s) => [s, process.listenerCount(s)])
      );

      orchestrator.setupSignalHandlers();
      for (const s of signals) {
        expect(process.listenerCount(s)).toBe(before[s] + 1);
      }

      await orchestrator.dispose();
      for (const s of signals) {
        expect(process.listenerCount(s)).toBe(before[s]);
      }
      expect(
        orchestrator.forkedProcessTaskRunner.removeProcessEventListeners
      ).toHaveBeenCalled();
    });

    it('should reap child processes before removing the last-resort exit handler', async () => {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      orchestrator.signalHandlers = [];
      const order: string[] = [];
      orchestrator.forkedProcessTaskRunner = {
        // cleanup() dispatches the child kills and the exit handler is the
        // last-resort kill, so the handler must not be removed first. The
        // push happens after a real async hop so that dropping the await in
        // dispose() flips the recorded order and fails this test.
        cleanup: jest.fn(async () => {
          await new Promise((r) => setImmediate(r));
          order.push('cleanup');
        }),
        removeProcessEventListeners: jest.fn(() => {
          order.push('removeProcessEventListeners');
        }),
      };

      await orchestrator.dispose();

      expect(order).toEqual(['cleanup', 'removeProcessEventListeners']);
    });

    it('should resolve waitForContinuousTaskExit even for an exit that already happened', async () => {
      const orchestrator: any = Object.create(TaskOrchestrator.prototype);
      const exitHandled = Promise.resolve();
      orchestrator.continuousTaskExitHandled = new Map([
        ['proj:serve', exitHandled],
      ]);

      // The creation-time promise is returned as-is; an unknown id (task
      // never started, or already fully handled) resolves immediately
      // rather than hanging disposal.
      expect(orchestrator.waitForContinuousTaskExit('proj:serve')).toBe(
        exitHandled
      );
      await orchestrator.waitForContinuousTaskExit('proj:unknown');
    });
  });
});
