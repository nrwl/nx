jest.mock('../../../native', () => ({
  isAiAgent: jest.fn(() => false),
}));

import { isAiAgent } from '../../../native';
import { isInsideAgent } from './inception';

const mockIsAiAgent = isAiAgent as unknown as jest.Mock;

describe('isInsideAgent', () => {
  beforeEach(() => {
    mockIsAiAgent.mockReset();
    mockIsAiAgent.mockReturnValue(false);
  });

  it('returns false when the native detector returns false', () => {
    expect(isInsideAgent()).toBe(false);
  });

  it('returns true when the native detector returns true', () => {
    mockIsAiAgent.mockReturnValue(true);
    expect(isInsideAgent()).toBe(true);
  });
});
