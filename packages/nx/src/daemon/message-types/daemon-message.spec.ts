import {
  assertValidDaemonMessage,
  isForeignWorkspaceMessage,
} from './daemon-message';

describe('isForeignWorkspaceMessage', () => {
  const daemonRoot = '/Users/me/workspace';

  it('should be false when the workspace roots match', () => {
    expect(
      isForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: daemonRoot },
        daemonRoot
      )
    ).toBe(false);
  });

  it('should be true when the workspace roots differ only by case', () => {
    // The two roots are produced by the same workspace-root resolution, so they
    // are compared directly (no case-insensitive sanitizing).
    expect(
      isForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: '/Users/ME/Workspace' },
        daemonRoot
      )
    ).toBe(true);
  });

  it('should be true when the workspace roots differ', () => {
    expect(
      isForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: '/Users/me/other-workspace' },
        daemonRoot
      )
    ).toBe(true);
  });

  it('should be false when the message has no workspace root', () => {
    expect(isForeignWorkspaceMessage({ type: 'PING' }, daemonRoot)).toBe(false);
  });
});

describe('assertValidDaemonMessage', () => {
  const daemonRoot = '/Users/me/workspace';

  it('does not throw when the workspace roots match', () => {
    expect(() =>
      assertValidDaemonMessage(
        { type: 'PING', workspaceRoot: daemonRoot },
        daemonRoot
      )
    ).not.toThrow();
  });

  it('does not throw when the message has no workspace root', () => {
    expect(() =>
      assertValidDaemonMessage({ type: 'PING' }, daemonRoot)
    ).not.toThrow();
  });

  it('throws with both workspace roots when they differ', () => {
    expect(() =>
      assertValidDaemonMessage(
        { type: 'PING', workspaceRoot: '/Users/me/other-workspace' },
        daemonRoot
      )
    ).toThrow(/other-workspace/);
  });
});
