jest.mock('../native', () => ({
  detectAiAgent: jest.fn(),
  getMainWorktreeRoot: jest.fn(),
}));

import { detectAiAgent, getMainWorktreeRoot } from '../native';
import {
  getWorktreeDataRoot,
  NX_INTERNAL_USE_LOCAL_WORKTREE_DATA,
  shouldUseLocalWorktreeData,
} from './worktree-data-root';

const mockDetectAiAgent = detectAiAgent as jest.MockedFunction<
  typeof detectAiAgent
>;
const mockGetMainWorktreeRoot = getMainWorktreeRoot as jest.MockedFunction<
  typeof getMainWorktreeRoot
>;

describe('worktree data root', () => {
  const sandboxEnvVars = [
    'SANDBOX_RUNTIME',
    'GEMINI_SANDBOX',
    'CODEX_SANDBOX',
    'CODEX_SANDBOX_NETWORK_DISABLED',
    'CURSOR_SANDBOX',
  ];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of [
      ...sandboxEnvVars,
      NX_INTERNAL_USE_LOCAL_WORKTREE_DATA,
    ]) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of [
      ...sandboxEnvVars,
      NX_INTERNAL_USE_LOCAL_WORKTREE_DATA,
    ]) {
      delete process.env[key];
    }
    mockDetectAiAgent.mockReturnValue(null);
    mockGetMainWorktreeRoot.mockReturnValue('/main');
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('shares the main worktree data outside a sandbox', () => {
    mockDetectAiAgent.mockReturnValue('codex');

    expect(shouldUseLocalWorktreeData()).toBe(false);
    expect(getWorktreeDataRoot('/worktree')).toBe('/main');
  });

  it('keeps sharing enabled for Claude inside a sandbox', () => {
    process.env.SANDBOX_RUNTIME = '1';
    mockDetectAiAgent.mockReturnValue('claude');

    expect(shouldUseLocalWorktreeData()).toBe(false);
    expect(getWorktreeDataRoot('/worktree')).toBe('/main');
  });

  it.each(['codex', 'opencode', 'cursor', 'gemini', 'copilot'])(
    'uses worktree-local data for sandboxed %s',
    (agent) => {
      process.env.CODEX_SANDBOX = 'seatbelt';
      mockDetectAiAgent.mockReturnValue(agent);

      expect(shouldUseLocalWorktreeData()).toBe(true);
      expect(getWorktreeDataRoot('/worktree')).toBe('/worktree');
      expect(mockGetMainWorktreeRoot).not.toHaveBeenCalled();
    }
  );

  it('uses worktree-local data in a sandbox when no agent is detected', () => {
    process.env.SANDBOX_RUNTIME = '1';

    expect(shouldUseLocalWorktreeData()).toBe(true);
    expect(getWorktreeDataRoot('/worktree')).toBe('/worktree');
  });

  it('honors the daemon propagation marker after agent env vars are stripped', () => {
    process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA] = 'true';

    expect(shouldUseLocalWorktreeData()).toBe(true);
    expect(getWorktreeDataRoot('/worktree')).toBe('/worktree');
  });

  it('keeps Claude sharing enabled after agent env vars are stripped', () => {
    process.env.SANDBOX_RUNTIME = '1';
    process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA] = 'false';

    expect(shouldUseLocalWorktreeData()).toBe(false);
    expect(getWorktreeDataRoot('/worktree')).toBe('/main');
  });

  it('falls back to the local root when main-worktree detection fails', () => {
    mockGetMainWorktreeRoot.mockImplementation(() => {
      throw new Error('not a git worktree');
    });

    expect(getWorktreeDataRoot('/worktree')).toBe('/worktree');
  });
});
