vi.mock('fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs')>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  ProjectFileMap,
  ProjectGraph,
} from '../../../config/project-graph';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import type { PackageJson } from '../../../utils/package-json';
import { createPackageJson } from './create-package-json';

describe('createPackageJson peer dependency collection', () => {
  const graphPackageNames = new Set(['fixture-not-installed']);
  let workspace: TempFs;

  function writePackage(name: string, manifest: Partial<PackageJson>) {
    graphPackageNames.add(name);
    workspace.createFilesSync({
      [`node_modules/${name}/package.json`]: JSON.stringify({
        name,
        version: '1.0.0',
        ...manifest,
      }),
      [`node_modules/${name}/index.js`]: '',
    });
  }

  function writePackageWithPeer(name: string, manifest: Partial<PackageJson>) {
    writePackage(name, {
      peerDependencies: { [`${name}-peer`]: '*' },
      ...manifest,
    });
    writePackage(`${name}-peer`, {});
  }

  function createAppPackageJson(directDependencies: string[]): PackageJson {
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

    return createPackageJson(
      'app',
      graph,
      { root: workspace.tempDir },
      fileMap
    );
  }

  beforeAll(() => {
    workspace = new TempFs('create-package-json-', false);
    workspace.createFileSync('package.json', '{}');
    writePackageWithPeer('fixture-wildcard-exports', {
      exports: { '.': './index.js', './*': './*.js' },
    });
    writePackageWithPeer('fixture-import-only-exports', {
      exports: { '.': { import: './index.js' } },
    });
    writePackageWithPeer('fixture-no-dot-exports', {
      exports: { './sub': './index.js' },
    });
    writePackageWithPeer('fixture-dual-exports', {
      exports: {
        '.': { import: './dist/esm/index.js', require: './dist/cjs/index.js' },
      },
    });
    workspace.createFilesSync({
      'node_modules/fixture-dual-exports/dist/cjs/index.js': '',
      'node_modules/fixture-dual-exports/dist/cjs/package.json':
        '{"type":"commonjs"}',
    });
    writePackage('fixture-transitive-host', {
      peerDependencies: { 'fixture-wildcard-exports': '*' },
    });
    writePackage('fixture-optional-host', {
      exports: { '.': './index.js' },
      peerDependencies: { 'fixture-optional': '*' },
      peerDependenciesMeta: { 'fixture-optional': { optional: true } },
    });
    writePackage('fixture-optional', {});
    writePackage('fixture-required-host', {
      peerDependencies: { 'fixture-optional': '*' },
    });
  });

  afterAll(() => {
    workspace.cleanup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ['a wildcard exports map', 'fixture-wildcard-exports'],
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
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('fixture-not-installed')
    );
  });

  it('reads a package.json once across repeated calls', () => {
    writePackageWithPeer('fixture-repeated', {});
    const manifestPath = join(
      workspace.tempDir,
      'node_modules',
      'fixture-repeated',
      'package.json'
    );

    createAppPackageJson(['fixture-repeated']);
    const packageJson = createAppPackageJson(['fixture-repeated']);

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
