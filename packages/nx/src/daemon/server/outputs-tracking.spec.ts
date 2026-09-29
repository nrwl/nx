vi.mock('../../utils/workspace-context', () => ({
  recordOutputsInContext: vi.fn(),
  outputsUnchangedInContext: vi.fn(() => [true]),
}));

import {
  outputsUnchangedInContext,
  recordOutputsInContext,
} from '../../utils/workspace-context';
import {
  disableOutputsTracking,
  outputsHashesMatchBatch,
  recordOutputsHashBatch,
} from './outputs-tracking';

describe('outputs tracking', () => {
  const entries = [{ outputs: ['dist/app'], hash: 'h1' }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records and checks outputs through the workspace context', () => {
    recordOutputsHashBatch(entries);
    expect(recordOutputsInContext).toHaveBeenCalledWith(
      expect.any(String),
      entries
    );
    expect(outputsHashesMatchBatch(entries)).toEqual([true]);
  });

  // Runs last: disabling is permanent for the module.
  it('stops recording and never matches once disabled', () => {
    disableOutputsTracking();

    recordOutputsHashBatch(entries);
    expect(recordOutputsInContext).not.toHaveBeenCalled();
    expect(outputsHashesMatchBatch(entries)).toEqual([false]);
    expect(outputsUnchangedInContext).not.toHaveBeenCalled();
  });
});
