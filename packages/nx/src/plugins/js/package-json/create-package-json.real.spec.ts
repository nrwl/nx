vi.mock('fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs')>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

import Module from 'module';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type {
  ProjectFileMap,
  ProjectGraph,
} from '../../../config/project-graph';
import type { PackageJson } from '../../../utils/package-json';
import { createPackageJson } from './create-package-json';

describe('createPackageJson peer dependency collection', () => {
  const originalNodePath = process.env.NODE_PATH;
  const roots: string[] = [];
  const graphPackageNames = new Set(['fixture-not-installed']);
  let workspace: string;

  function createWorkspace() {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'create-package-json-'))
    );
    writeFileSync(join(root, 'package.json'), '{}');
    roots.push(root);
    return root;
  }

  function writePackage(
    root: string,
    name: string,
    manifest: Partial<PackageJson>,
    files: Record<string, string> = { 'index.js': '' }
  ) {
    graphPackageNames.add(name);
    const pkgDir = join(root, 'node_modules', name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', ...manifest })
    );
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(join(pkgDir, dirname(file)), { recursive: true });
      writeFileSync(join(pkgDir, file), content);
    }
  }

  function writePackageWithPeer(
    name: string,
    manifest: Partial<PackageJson>,
    files?: Record<string, string>
  ) {
    writePackage(
      workspace,
      name,
      { peerDependencies: { [`${name}-peer`]: '*' }, ...manifest },
      files
    );
    writePackage(workspace, `${name}-peer`, {});
  }

  function createAppPackageJson(
    directDependencies: string[],
    root = workspace
  ): PackageJson {
    const graph: ProjectGraph = {
      nodes: {
        app: { type: 'app', name: 'app', data: { root: 'apps/app' } },
      },
      externalNodes: Object.fromEntries(
        [...graphPackageNames].map((name) => [
          `npm:${name}`,
          {
            type: 'npm',
            name: `npm:${name}`,
            data: { packageName: name, version: '1.0.0', hash: '' },
          },
        ])
      ),
      dependencies: {},
    };
    const fileMap: ProjectFileMap = {
      app: [
        {
          file: 'apps/app/src/main.ts',
          hash: '',
          deps: directDependencies.map((name) => `npm:${name}`),
        },
      ],
    };

    return createPackageJson('app', graph, { root }, fileMap);
  }

  beforeAll(() => {
    workspace = createWorkspace();
    writePackageWithPeer('fixture-legacy-exports', {});
    writePackageWithPeer('fixture-wildcard-exports', {
      exports: { '.': './index.js', './*': './*.js' },
    });
    writePackageWithPeer('fixture-dot-only-exports', {
      exports: { '.': './index.js' },
    });
    writePackageWithPeer(
      'fixture-import-only-exports',
      { exports: { '.': { import: './index.mjs' } } },
      { 'index.mjs': '' }
    );
    writePackageWithPeer(
      'fixture-no-dot-exports',
      { exports: { './sub': './sub.js' } },
      { 'sub.js': '' }
    );
    writePackageWithPeer(
      'fixture-dual-exports',
      {
        exports: {
          '.': {
            import: './dist/esm/index.js',
            require: './dist/cjs/index.js',
          },
        },
      },
      {
        'dist/cjs/index.js': '',
        'dist/cjs/package.json': '{"type":"commonjs"}',
        'dist/esm/index.js': '',
      }
    );
    writePackage(workspace, 'fixture-transitive-host', {
      peerDependencies: { 'fixture-wildcard-exports': '*' },
    });
    writePackage(workspace, 'fixture-optional-host', {
      exports: { '.': './index.js' },
      peerDependencies: { 'fixture-optional': '*' },
      peerDependenciesMeta: { 'fixture-optional': { optional: true } },
    });
    writePackage(workspace, 'fixture-optional', {});
    writePackage(workspace, 'fixture-required-host', {
      peerDependencies: { 'fixture-optional': '*' },
    });

    // Makes the fixtures resolvable from nx's own location, as packages
    // installed next to nx are.
    process.env.NODE_PATH = join(workspace, 'node_modules');
    (Module as any)._initPaths();
  });

  afterAll(() => {
    if (originalNodePath === undefined) {
      delete process.env.NODE_PATH;
    } else {
      process.env.NODE_PATH = originalNodePath;
    }
    (Module as any)._initPaths();
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ['no exports map', 'fixture-legacy-exports'],
    ['a wildcard exports map', 'fixture-wildcard-exports'],
    ['a "." entry only', 'fixture-dot-only-exports'],
    ['an import-only entry', 'fixture-import-only-exports'],
    ['no "." entry', 'fixture-no-dot-exports'],
    ['a require entry next to a nested package.json', 'fixture-dual-exports'],
  ])('collects the peers of a package with %s', (_, name) => {
    expect(createAppPackageJson([name]).peerDependencies).toEqual({
      [`${name}-peer`]: '1.0.0',
    });
  });

  it('collects the peers of a peer whose exports map hides package.json', () => {
    expect(
      createAppPackageJson(['fixture-transitive-host']).peerDependencies
    ).toEqual({
      'fixture-wildcard-exports': '1.0.0',
      'fixture-wildcard-exports-peer': '1.0.0',
    });
  });

  it('keeps the optional flag of a peer declared in a hidden package.json', () => {
    const packageJson = createAppPackageJson(['fixture-optional-host']);

    expect(packageJson.peerDependencies).toEqual({
      'fixture-optional': '1.0.0',
    });
    expect(packageJson.peerDependenciesMeta).toEqual({
      'fixture-optional': { optional: true },
    });
  });

  it.each([
    ['after', ['fixture-optional-host', 'fixture-required-host']],
    ['before', ['fixture-required-host', 'fixture-optional-host']],
  ])(
    'keeps a peer required when a host requiring it is visited %s the host marking it optional',
    (_, directDependencies) => {
      const packageJson = createAppPackageJson(directDependencies);

      expect(packageJson.peerDependencies).toEqual({
        'fixture-optional': '1.0.0',
      });
      expect(packageJson.peerDependenciesMeta).toBeUndefined();
    }
  );

  it('skips a package that is not installed and reports it in verbose mode', () => {
    vi.stubEnv('NX_VERBOSE_LOGGING', 'true');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const packageJson = createAppPackageJson(['fixture-not-installed']);

    expect(packageJson.dependencies).toEqual({
      'fixture-not-installed': '1.0.0',
    });
    expect(packageJson.peerDependencies).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('fixture-not-installed')
    );
  });

  it('resolves packages from the root passed to createPackageJson', () => {
    const otherRoot = createWorkspace();
    writePackage(otherRoot, 'fixture-root-only', {
      peerDependencies: { 'fixture-root-only-peer': '*' },
    });
    writePackage(otherRoot, 'fixture-root-only-peer', {});

    expect(
      createAppPackageJson(['fixture-root-only'], otherRoot).peerDependencies
    ).toEqual({ 'fixture-root-only-peer': '1.0.0' });
  });

  it('reads a package.json once across repeated calls', () => {
    const otherRoot = createWorkspace();
    writePackage(otherRoot, 'fixture-repeated', {
      peerDependencies: { 'fixture-repeated-peer': '*' },
    });
    writePackage(otherRoot, 'fixture-repeated-peer', {});
    const manifestPath = join(
      otherRoot,
      'node_modules',
      'fixture-repeated',
      'package.json'
    );

    createAppPackageJson(['fixture-repeated'], otherRoot);
    const packageJson = createAppPackageJson(['fixture-repeated'], otherRoot);

    expect(packageJson.peerDependencies).toEqual({
      'fixture-repeated-peer': '1.0.0',
    });
    expect(
      vi
        .mocked(readFileSync)
        .mock.calls.filter(([path]) => path === manifestPath)
    ).toHaveLength(1);
  });
});
