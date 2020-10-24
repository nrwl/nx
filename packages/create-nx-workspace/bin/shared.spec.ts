import { determinePackageManager } from './shared';

let INSTALLED_PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm'];

jest.mock('child_process', () => {
  return {
    execSync: (command) => {
      if (command.endsWith(`--version`)) {
        const pm = command.split(' ')[0];
        if (INSTALLED_PACKAGE_MANAGERS.includes(pm)) {
          return;
        }
        throw Error();
      }
    },
  };
});

describe('determinePackageManager', () => {
  it('will prefer Yarn if installed and there is no preference', () => {
    const pm = determinePackageManager();
    expect(pm).toEqual('yarn');
  });

  it('will use preferred one if installed', () => {
    expect(determinePackageManager('pnpm')).toEqual('pnpm');
    expect(determinePackageManager('yarn')).toEqual('yarn');
    expect(determinePackageManager('npm')).toEqual('npm');
  });

  it('will not use preferred one if not installed', () => {
    INSTALLED_PACKAGE_MANAGERS = ['npm', 'pnpm'];
    const pm = determinePackageManager('yarn');
    expect(pm).toEqual('pnpm');
  });

  it('will fallback to NPM', () => {
    INSTALLED_PACKAGE_MANAGERS = [];
    const pm = determinePackageManager();
    expect(pm).toEqual('npm');
  });
});
