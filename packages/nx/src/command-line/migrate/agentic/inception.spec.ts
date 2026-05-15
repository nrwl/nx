jest.mock('../../../native', () => ({
  isAiAgent: jest.fn(() => false),
}));

import { isAiAgent } from '../../../native';
import { isInsideAgent } from './inception';

const mockIsAiAgent = isAiAgent as unknown as jest.Mock;
const originalCodexThreadId = process.env.CODEX_THREAD_ID;

describe('isInsideAgent', () => {
  beforeEach(() => {
    mockIsAiAgent.mockReset();
    mockIsAiAgent.mockReturnValue(false);
    delete process.env.CODEX_THREAD_ID;
  });

  afterAll(() => {
    if (originalCodexThreadId === undefined) {
      delete process.env.CODEX_THREAD_ID;
    } else {
      process.env.CODEX_THREAD_ID = originalCodexThreadId;
    }
  });

  it('returns false when neither the native check nor the Codex env var is set', () => {
    expect(isInsideAgent()).toBe(false);
  });

  it('returns true when the native detector returns true', () => {
    mockIsAiAgent.mockReturnValue(true);
    expect(isInsideAgent()).toBe(true);
  });

  it('returns true when CODEX_THREAD_ID is set, even if native says no', () => {
    process.env.CODEX_THREAD_ID = 'thread-abc';
    expect(isInsideAgent()).toBe(true);
  });
});
