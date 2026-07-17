import { isForeignWorkspaceMessage } from './daemon-message';

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

  it('should be false when the workspace roots differ only by case', () => {
    expect(
      isForeignWorkspaceMessage(
        { type: 'PING', workspaceRoot: '/Users/ME/Workspace' },
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
});
