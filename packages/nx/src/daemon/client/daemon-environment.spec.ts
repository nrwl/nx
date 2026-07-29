jest.mock('../../utils/worktree-data-root', () => ({
  NX_INTERNAL_USE_LOCAL_WORKTREE_DATA: 'NX_INTERNAL_USE_LOCAL_WORKTREE_DATA',
  shouldUseLocalWorktreeData: jest.fn(),
}));

import {
  NX_INTERNAL_USE_LOCAL_WORKTREE_DATA,
  shouldUseLocalWorktreeData,
} from '../../utils/worktree-data-root';
import { getDaemonEnv } from './daemon-environment';

const mockShouldUseLocalWorktreeData =
  shouldUseLocalWorktreeData as jest.MockedFunction<
    typeof shouldUseLocalWorktreeData
  >;

describe('getDaemonEnv', () => {
  const originalMarker = process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA];

  beforeEach(() => {
    delete process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA];
    mockShouldUseLocalWorktreeData.mockReset();
  });

  afterAll(() => {
    if (originalMarker === undefined) {
      delete process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA];
    } else {
      process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA] = originalMarker;
    }
  });

  it('propagates the worktree-local decision to the daemon', () => {
    mockShouldUseLocalWorktreeData.mockReturnValue(true);

    expect(getDaemonEnv()[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA]).toBe('true');
  });

  it('propagates the shared worktree decision to the daemon', () => {
    mockShouldUseLocalWorktreeData.mockReturnValue(false);

    expect(getDaemonEnv()[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA]).toBe('false');
  });
});
