import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveFromWorkspace } from './installation-directory';

describe('resolveFromWorkspace', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-resolve-workspace-')));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function install(name: string) {
    const directory = join(root, 'node_modules', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name, main: 'index.js' })
    );
    writeFileSync(join(directory, 'index.js'), 'module.exports = {};\n');
    return join(directory, 'index.js');
  }

  it('resolves a package only the workspace installs, which nx cannot see from its own location', () => {
    const installed = install('workspace-only-package');

    expect(() => require.resolve('workspace-only-package')).toThrow();
    expect(resolveFromWorkspace('workspace-only-package', root)).toBe(
      installed
    );
  });

  it('prefers the workspace installation over the one beside nx', () => {
    const installed = install('typescript');

    expect(resolveFromWorkspace('typescript', root)).toBe(installed);
  });

  it('still resolves what only nx itself depends on', () => {
    expect(resolveFromWorkspace('semver', root)).toBe(
      require.resolve('semver')
    );
  });
});
