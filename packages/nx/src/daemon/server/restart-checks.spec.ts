// Stub the shutdown path so a restart decision can be observed without taking
// it. vi.hoisted runs before the hoisted vi.mock factories, which is the only
// way the spy can be shared with them.
const { terminate } = vi.hoisted(() => ({ terminate: vi.fn() }));
vi.mock('./shutdown-utils', () => ({
  handleServerProcessTermination: terminate,
}));

import {
  registerDaemonForRestartChecks,
  restartDaemonIfIgnoreFilesChanged,
} from './restart-checks';

describe('restartDaemonIfIgnoreFilesChanged', () => {
  beforeEach(() => {
    terminate.mockClear();
    registerDaemonForRestartChecks({} as import('net').Server, []);
  });

  it.each(['.gitignore', '.nxignore'])(
    'restarts the daemon when %s changes',
    (name) => {
      expect(restartDaemonIfIgnoreFilesChanged([`pkg/${name}`])).toBe(true);
      expect(terminate).toHaveBeenCalledTimes(1);
    }
  );

  // .ignore is a ripgrep convention neither create_walker nor the watch
  // filterer reads, so editing one changes no rule and must not cost a restart.
  it('leaves the daemon running when a .ignore changes', () => {
    expect(restartDaemonIfIgnoreFilesChanged(['pkg/.ignore'])).toBe(false);
    expect(terminate).not.toHaveBeenCalled();
  });
});
