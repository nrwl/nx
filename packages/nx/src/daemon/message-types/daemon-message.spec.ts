import {
  assertNotForeignWorkspaceMessage,
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

describe('assertNotForeignWorkspaceMessage', () => {
  const receiverRoot = '/Users/me/workspace';

  it('does not throw when the workspace roots match', () => {
    expect(() =>
      assertNotForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: receiverRoot },
        receiverRoot
      )
    ).not.toThrow();
  });

  it('does not throw when the message has no workspace root', () => {
    expect(() =>
      assertNotForeignWorkspaceMessage({ type: 'PING' }, receiverRoot)
    ).not.toThrow();
  });

  it('throws with both workspace roots when they differ', () => {
    expect(() =>
      assertNotForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: '/Users/me/other-workspace' },
        receiverRoot
      )
    ).toThrow(/other-workspace/);
  });

  it('names the Nx Daemon in the error by default', () => {
    // The daemon relies on the default description; keep that wording stable.
    expect(() =>
      assertNotForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: '/Users/me/other-workspace' },
        receiverRoot
      )
    ).toThrow(`The Nx Daemon for '${receiverRoot}'`);
  });

  it('uses a custom receiver description so plugin workers can reuse it', () => {
    // The plugin worker passes its own description; the shared assertion must
    // surface it instead of the daemon wording.
    expect(() =>
      assertNotForeignWorkspaceMessage(
        { type: 'load', workspaceRoot: '/Users/me/other-workspace' },
        receiverRoot,
        'The Nx plugin worker "my-plugin" (pid: 123)'
      )
    ).toThrow(/The Nx plugin worker "my-plugin" \(pid: 123\)/);
  });
});
