import {
  assertNotForeignWorkspaceMessage,
  isForeignWorkspaceMessage,
} from './daemon-message';

describe('isForeignWorkspaceMessage', () => {
  const daemonRoot = '/Users/me/workspace';
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should be false when the workspace roots match', () => {
    expect(
      isForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: daemonRoot },
        daemonRoot
      )
    ).toBe(false);
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

  describe('on POSIX', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });

    it('should be true when the workspace roots differ only by case', () => {
      // POSIX paths are case-sensitive, so /Users/ME really can be a second
      // directory. Only Windows may fold case.
      expect(
        isForeignWorkspaceMessage(
          { type: 'PING', workspaceRoot: '/Users/ME/Workspace' },
          daemonRoot
        )
      ).toBe(true);
    });
  });

  describe('on Windows', () => {
    const windowsRoot = 'D:\\repo';

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('should be false when only the drive letter case differs', () => {
      // The reported failure: one side is handed NX_WORKSPACE_ROOT_PATH as
      // 'd:\repo' verbatim while the other derives 'D:\repo' from process.cwd(),
      // and the daemon refuses its own workspace.
      expect(
        isForeignWorkspaceMessage(
          { type: 'PING', workspaceRoot: 'd:\\repo' },
          windowsRoot
        )
      ).toBe(false);
    });

    it('should be false when the rest of the path differs by case', () => {
      expect(
        isForeignWorkspaceMessage(
          { type: 'PING', workspaceRoot: 'D:\\Repo' },
          windowsRoot
        )
      ).toBe(false);
    });

    it('should be false when the separators differ', () => {
      expect(
        isForeignWorkspaceMessage(
          { type: 'PING', workspaceRoot: 'D:/repo' },
          windowsRoot
        )
      ).toBe(false);
    });

    it('should still be true for a genuinely different workspace', () => {
      expect(
        isForeignWorkspaceMessage(
          { type: 'PING', workspaceRoot: 'D:\\other-repo' },
          windowsRoot
        )
      ).toBe(true);
    });
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
