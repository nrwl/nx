import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  resolveFromWorkspace,
  resolveInstalledPackage,
  resolveNxBinFrom,
} from './installation-directory';
import * as ownedPrivateDir from './owned-private-dir';

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

describe('resolveInstalledPackage', () => {
  let shared: string;
  let root: string;

  beforeEach(() => {
    shared = realpathSync(mkdtempSync(join(tmpdir(), 'nx-resolve-shared-')));
    root = join(shared, 'workspace');
    mkdirSync(root);
  });

  afterEach(() => {
    rmSync(shared, { recursive: true, force: true });
  });

  function install(dir: string, name: string, file = 'index.js') {
    const directory = join(dir, 'node_modules', name);
    mkdirSync(join(directory, 'lib'), { recursive: true });
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name }));
    writeFileSync(join(directory, file), 'module.exports = {};\n');
    return join(directory, file);
  }

  const notFound = expect.objectContaining({ code: 'MODULE_NOT_FOUND' });

  it('resolves a package and its subpaths installed in the workspace', () => {
    const main = install(root, 'optional-package');
    const sub = install(root, 'optional-package', 'lib/init.js');

    expect(resolveInstalledPackage('optional-package', [root], root)).toBe(
      main
    );
    expect(
      resolveInstalledPackage('optional-package/lib/init.js', [root], root)
    ).toBe(sub);
  });

  it('follows a package linked into the workspace', () => {
    const linked = join(root, 'packages', 'linked');
    mkdirSync(linked, { recursive: true });
    writeFileSync(join(linked, 'package.json'), '{}');
    writeFileSync(join(linked, 'index.js'), '');
    mkdirSync(join(root, 'node_modules', '@scope'), { recursive: true });
    symlinkSync(linked, join(root, 'node_modules', '@scope', 'linked'));

    expect(resolveInstalledPackage('@scope/linked', [root], root)).toBe(
      join(linked, 'index.js')
    );
  });

  it('ignores a package in node_modules above the workspace', () => {
    install(shared, 'optional-package');
    install(shared, '@scope/optional-package');

    expect(() =>
      resolveInstalledPackage('optional-package', [root], root)
    ).toThrow(notFound);
    expect(() =>
      resolveInstalledPackage('@scope/optional-package', [root], root)
    ).toThrow(notFound);
    expect(() => resolveFromWorkspace('optional-package', root)).toThrow(
      notFound
    );
  });

  it('does not fall through to a package above the workspace from an incomplete one inside it', () => {
    install(shared, 'optional-package', 'lib/init.js');
    install(root, 'optional-package');

    expect(() =>
      resolveInstalledPackage('optional-package/lib/init.js', [root], root)
    ).toThrow(notFound);
  });

  it('prefers the copy inside the workspace over one above it', () => {
    install(shared, 'optional-package');
    const main = install(root, 'optional-package');

    expect(resolveInstalledPackage('optional-package', [root], root)).toBe(
      main
    );
  });
});

describe('resolveNxBinFrom', () => {
  let shared: string;
  let nxBin: string;
  let ws: string;

  beforeEach(() => {
    shared = realpathSync(mkdtempSync(join(tmpdir(), 'nx-resolve-nx-bin-')));
    const nxDir = join(shared, 'node_modules', 'nx');
    mkdirSync(join(nxDir, 'bin'), { recursive: true });
    writeFileSync(
      join(nxDir, 'package.json'),
      JSON.stringify({ name: 'nx', version: '1.0.0' })
    );
    nxBin = join(nxDir, 'bin', 'nx.js');
    writeFileSync(nxBin, '');
    // A fresh clone: nx.json, no node_modules of its own.
    ws = join(shared, 'ws');
    mkdirSync(ws);
    writeFileSync(join(ws, 'nx.json'), '{}');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(shared, { recursive: true, force: true });
  });

  it('resolves nx from an ancestor install we trust', () => {
    expect(resolveNxBinFrom(ws)).toBe(nxBin);
  });

  it('refuses nx from an ancestor install another user planted', () => {
    const trusted = vi
      .spyOn(ownedPrivateDir, 'isTrustedAncestorEntry')
      .mockImplementation((dir) => dir !== shared);

    expect(() => resolveNxBinFrom(ws)).toThrow();
    expect(trusted).toHaveBeenCalledWith(shared, 'node_modules');
  });

  it('refuses an untrusted install whose bin/nx.js links outside it', () => {
    const elsewhere = join(shared, 'elsewhere.js');
    writeFileSync(elsewhere, '');
    rmSync(nxBin);
    symlinkSync(elsewhere, nxBin);
    vi.spyOn(ownedPrivateDir, 'isTrustedAncestorEntry').mockImplementation(
      (dir) => dir !== shared
    );

    expect(() => resolveNxBinFrom(ws)).toThrow();
  });

  it('judges the install nx resolves from, past an incomplete local one', () => {
    mkdirSync(join(ws, 'node_modules', 'nx'), { recursive: true });
    vi.spyOn(ownedPrivateDir, 'isTrustedAncestorEntry').mockImplementation(
      (dir) => dir !== shared
    );

    expect(() => resolveNxBinFrom(ws)).toThrow();
  });
});
