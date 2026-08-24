import { addNxToAngularCliRepo } from './index';
import type { Options } from './types';

jest.mock('./legacy-angular-versions', () => ({
  getLegacyMigrationFunctionIfApplicable: jest.fn(),
}));

jest.mock('../format', () => ({
  formatInitWrites: jest.fn(() => Promise.resolve()),
  recordInitWrite: jest.fn(),
}));

jest.mock('../../../../utils/output', () => ({
  output: {
    log: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { formatInitWrites } from '../format';
import { getLegacyMigrationFunctionIfApplicable } from './legacy-angular-versions';

describe('addNxToAngularCliRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should drain the recorded writes after the migration and before the legacy flow exits', async () => {
    const legacyMigrationFn = jest.fn().mockResolvedValue(undefined);
    (getLegacyMigrationFunctionIfApplicable as jest.Mock).mockResolvedValue(
      legacyMigrationFn
    );
    // Left pending so the test can observe what runs while the drain is still
    // in flight.
    let resolveDrain: () => void;
    (formatInitWrites as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => (resolveDrain = resolve))
    );
    // Throwing stops execution at the exit call like the real exit does, so
    // anything the flow only runs after it can never be observed by the
    // assertions below.
    const exitError = new Error('process.exit called');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw exitError;
    });

    try {
      const run = addNxToAngularCliRepo({
        integrated: false,
        interactive: false,
      } as Options);
      // A macrotask flushes every microtask queued so far, which carries the
      // flow up to the pending drain.
      await new Promise(setImmediate);

      expect(formatInitWrites).toHaveBeenCalledWith(process.cwd());
      // Migration first: draining before it would flush an empty set, and the
      // files it records would exit unformatted.
      expect(legacyMigrationFn.mock.invocationCallOrder[0]).toBeLessThan(
        (formatInitWrites as jest.Mock).mock.invocationCallOrder[0]
      );
      // The exit must wait for the drain: un-awaited, the process would die
      // mid-format.
      expect(exitSpy).not.toHaveBeenCalled();

      resolveDrain();
      await expect(run).rejects.toThrow(exitError);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
