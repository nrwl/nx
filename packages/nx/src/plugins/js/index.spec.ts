import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProjectGraphExternalNode } from '../../config/project-graph';
import overriddenLocalPathPnpmLock from './lock-file/__fixtures__/overridden-local-path/pnpm-lock.yaml';

const { root, workspaceDataDirectory } = vi.hoisted(() => {
  const { mkdtempSync, realpathSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-js-plugin-')));
  return {
    root,
    workspaceDataDirectory: join(root, '.nx', 'workspace-data'),
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    // `bun bun.lockb` prints the binary lockfile as a yarn lockfile, so specs
    // write yarn lockfile text to bun.lockb and this returns it unchanged.
    execSync: ((command: string, options) =>
      command.startsWith('bun ') && command.endsWith('bun.lockb')
        ? require('node:fs').readFileSync(command.slice('bun '.length), 'utf-8')
        : actual.execSync(command, options)) as typeof actual.execSync,
  };
});
vi.mock('../../utils/workspace-root', () => ({ workspaceRoot: root }));
vi.mock('../../utils/cache-directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/cache-directory')>()),
  workspaceDataDirectory,
}));

function write(path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

function writeWorkspace(rootDevDependencies: Record<string, string>) {
  const packages: Record<string, Record<string, string>> = {
    'a@1.0.0': { x: '1.0.0' },
    'b@1.0.0': { x: '2.0.0' },
    'x@1.0.0': {},
    'x@2.0.0': {},
  };
  for (const [name, version] of Object.entries(rootDevDependencies)) {
    packages[`${name}@${version}`] ??= {};
  }
  write(
    'package.json',
    JSON.stringify({ devDependencies: rootDevDependencies })
  );
  write(
    'pnpm-lock.yaml',
    [
      "lockfileVersion: '9.0'",
      'importers:',
      '  .:',
      '    devDependencies:',
      ...Object.entries(rootDevDependencies).flatMap(([name, version]) => [
        `      ${name}:`,
        `        specifier: ${version}`,
        `        version: ${version}`,
      ]),
      'packages:',
      ...Object.keys(packages).flatMap((key) => [
        `  ${key}:`,
        `    resolution: {integrity: sha512-${key}}`,
      ]),
      'snapshots:',
      ...Object.entries(packages).flatMap(([key, dependencies]) =>
        Object.keys(dependencies).length === 0
          ? [`  ${key}: {}`]
          : [
              `  ${key}:`,
              '    dependencies:',
              ...Object.entries(dependencies).map(
                ([name, version]) => `      ${name}: ${version}`
              ),
            ]
      ),
    ].join('\n')
  );
  for (const [name, version] of Object.entries(rootDevDependencies)) {
    write(`node_modules/${name}/package.json`, JSON.stringify({ version }));
  }
}

// A fresh module registry stands in for the next graph computation's process.
async function loadPluginInNewProcess() {
  vi.resetModules();
  return await import('./index');
}

async function createExternalNodes(
  plugin: Awaited<ReturnType<typeof loadPluginInNewProcess>>,
  lockFile = 'pnpm-lock.yaml'
): Promise<Record<string, ProjectGraphExternalNode>> {
  const [, createNodes] = plugin.createNodes;
  const [[, result]] = await createNodes([lockFile], undefined, {
    nxJsonConfiguration: {},
    workspaceRoot: root,
  });
  return result.externalNodes;
}

async function createDependencies(
  plugin: Awaited<ReturnType<typeof loadPluginInNewProcess>>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  // Files per project root, which also names the project
  projectFiles: Record<string, string[]> = {}
) {
  const projectFileMap = Object.fromEntries(
    Object.entries(projectFiles).map(([projectRoot, files]) => [
      projectRoot,
      files.map((file) => ({ file, hash: file })),
    ])
  );
  return await plugin.createDependencies(undefined, {
    nxJsonConfiguration: {
      pluginsConfig: { '@nx/js': { analyzeSourceFiles: true } },
    },
    workspaceRoot: root,
    externalNodes,
    projects: Object.fromEntries(
      Object.keys(projectFiles).map((projectRoot) => [
        projectRoot,
        { root: projectRoot },
      ])
    ),
    fileMap: { projectFileMap, nonProjectFiles: [] },
    filesToProcess: { projectFileMap, nonProjectFiles: [] },
  });
}

const yarnLockFile = `# yarn lockfile v1

a@1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/a/-/a-1.0.0.tgz"
  integrity sha512-a
  dependencies:
    x "1.0.0"

x@1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/x/-/x-1.0.0.tgz"
  integrity sha512-x
`;

const yarnLockFileWithTwoVersionsOfX = `${yarnLockFile}
b@1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/b/-/b-1.0.0.tgz"
  integrity sha512-b
  dependencies:
    x "2.0.0"

x@2.0.0:
  version "2.0.0"
  resolved "https://registry.yarnpkg.com/x/-/x-2.0.0.tgz"
  integrity sha512-x2
`;

describe('nx/js/dependencies-and-lockfile', () => {
  beforeEach(() => {
    write('nx.json', '{}');
    write('node_modules/.modules.yaml', '{"hoistedDependencies": {}}');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should not reuse lockfile dependencies computed against differently named external nodes', async () => {
    // Yarn names a package's node from node_modules, so an install can rename
    // it without changing the lockfile.
    write(
      'package.json',
      JSON.stringify({ devDependencies: { a: '1.0.0', b: '1.0.0' } })
    );
    write('yarn.lock', yarnLockFileWithTwoVersionsOfX);
    const first = await loadPluginInNewProcess();
    const firstNodes = await createExternalNodes(first, 'yarn.lock');
    expect(Object.keys(firstNodes)).toContain('npm:x@1.0.0');

    // A second process misses the first's nodes cache and sees x@1.0.0 linked
    // at the root, which renames its node to `npm:x`.
    rmSync(workspaceDataDirectory, { recursive: true });
    write('node_modules/x/package.json', JSON.stringify({ version: '1.0.0' }));
    const second = await loadPluginInNewProcess();
    const secondNodes = await createExternalNodes(second, 'yarn.lock');
    await createDependencies(first, firstNodes);

    expect(await createDependencies(second, secondNodes)).toEqual([
      { source: 'npm:a', target: 'npm:x', type: 'static' },
      { source: 'npm:b', target: 'npm:x@2.0.0', type: 'static' },
    ]);
  });

  it('should name pnpm external nodes the same however node_modules is linked', async () => {
    writeWorkspace({ a: '1.0.0', b: '1.0.0', x: '1.0.0' });
    rmSync(join(root, 'node_modules', 'x'), { recursive: true });
    const before = await createExternalNodes(await loadPluginInNewProcess());

    rmSync(workspaceDataDirectory, { recursive: true });
    write('node_modules/x/package.json', JSON.stringify({ version: '2.0.0' }));
    const after = await createExternalNodes(await loadPluginInNewProcess());

    expect(after).toEqual(before);
    expect(before['npm:x'].data.version).toEqual('1.0.0');
  });

  it('should recompute a cache that another process left partially written', async () => {
    writeWorkspace({ a: '1.0.0', b: '1.0.0' });
    const first = await loadPluginInNewProcess();
    const firstNodes = await createExternalNodes(first);
    await createDependencies(first, firstNodes);

    for (const file of readdirSync(workspaceDataDirectory)) {
      if (file.endsWith('.json')) {
        const path = join(workspaceDataDirectory, file);
        writeFileSync(path, readFileSync(path, 'utf-8').slice(0, 100));
      }
    }

    const second = await loadPluginInNewProcess();
    const secondNodes = await createExternalNodes(second);

    expect(secondNodes).toEqual(firstNodes);
    expect(await createDependencies(second, secondNodes)).toEqual([
      { source: 'npm:a', target: 'npm:x@1.0.0', type: 'static' },
      { source: 'npm:b', target: 'npm:x@2.0.0', type: 'static' },
    ]);
  });

  it('should create dependencies from the lockfile that createNodes read', async () => {
    writeWorkspace({ a: '1.0.0', b: '1.0.0' });
    // An earlier graph computation cached these nodes.
    await createExternalNodes(await loadPluginInNewProcess());
    const plugin = await loadPluginInNewProcess();
    const nodes = await createExternalNodes(plugin);

    // An install adds a package before createDependencies runs.
    writeWorkspace({ a: '1.0.0', b: '1.0.0', c: '1.0.0' });

    expect(await createDependencies(plugin, nodes)).toEqual([
      { source: 'npm:a', target: 'npm:x@1.0.0', type: 'static' },
      { source: 'npm:b', target: 'npm:x@2.0.0', type: 'static' },
    ]);
  });

  it('should parse dependencies in the lockfile format that createNodes read', async () => {
    write('package.json', JSON.stringify({ devDependencies: { a: '1.0.0' } }));
    write('bun.lockb', yarnLockFile);
    const plugin = await loadPluginInNewProcess();
    const nodes = await createExternalNodes(plugin, 'bun.lockb');

    // Bun migrates to the text lockfile before createDependencies runs.
    write('bun.lock', '{}');

    expect(await createDependencies(plugin, nodes)).toEqual([
      { source: 'npm:a', target: 'npm:x', type: 'static' },
    ]);
  });

  // lib and control declare the vendored `ms`, and an override installs the
  // registry `ms` of the same version for lib.
  it.each([['pnpm-lock.yaml', overriddenLocalPathPnpmLock, 'npm:ms']])(
    'should depend on the copy each project installs when an override replaces a local package in %s',
    async (lockFile, lockFileContent, registryNode) => {
      write(
        'package.json',
        JSON.stringify({
          name: 'ovr-root',
          workspaces: ['libs/*'],
          dependencies: { ms: '2.1.3' },
        })
      );
      write(lockFile, lockFileContent);
      write(
        'vendor/ms/package.json',
        JSON.stringify({ name: 'ms', version: '2.1.3' })
      );
      const projectFiles: Record<string, string[]> = {};
      for (const project of ['libs/lib', 'libs/control']) {
        write(
          `${project}/package.json`,
          JSON.stringify({ dependencies: { ms: 'file:../../vendor/ms' } })
        );
        write(`${project}/src/index.ts`, `import ms from 'ms';`);
        write(
          `${project}/node_modules/ms/package.json`,
          JSON.stringify({ name: 'ms', version: '2.1.3' })
        );
        projectFiles[project] = [
          `${project}/package.json`,
          `${project}/src/index.ts`,
        ];
      }
      const plugin = await loadPluginInNewProcess();

      const dependencies = await createDependencies(
        plugin,
        await createExternalNodes(plugin, lockFile),
        projectFiles
      );

      expect(
        dependencies
          .filter(({ source }) => source in projectFiles)
          .map(({ sourceFile, target }) => [sourceFile, target])
          .sort()
      ).toEqual([
        ['libs/control/package.json', 'npm:ms@file:vendor/ms'],
        ['libs/control/src/index.ts', 'npm:ms@file:vendor/ms'],
        ['libs/lib/package.json', registryNode],
        ['libs/lib/src/index.ts', registryNode],
      ]);
    }
  );

  it('should depend on the local copy npm nests under a project', async () => {
    write(
      'package.json',
      JSON.stringify({
        name: 'rvws',
        workspaces: ['libs/*'],
        dependencies: { x: 'file:vendor/x.tgz' },
      })
    );
    write(
      'package-lock.json',
      readFileSync(
        join(
          __dirname,
          'lock-file/__fixtures__/nested-local-path/package-lock.json.fixture'
        ),
        'utf-8'
      )
    );
    write(
      'libs/a/package.json',
      JSON.stringify({ name: '@rv/a', dependencies: { x: 'file:x-a.tgz' } })
    );
    write('libs/a/src/index.ts', `import x from 'x';`);
    write(
      'libs/a/node_modules/x/package.json',
      JSON.stringify({ name: 'x', version: '1.0.0' })
    );
    const projectFiles = {
      'libs/a': ['libs/a/package.json', 'libs/a/src/index.ts'],
    };
    const plugin = await loadPluginInNewProcess();

    const dependencies = await createDependencies(
      plugin,
      await createExternalNodes(plugin, 'package-lock.json'),
      projectFiles
    );

    expect(
      dependencies
        .filter(({ source }) => source === 'libs/a')
        .map(({ sourceFile, target }) => [sourceFile, target])
        .sort()
    ).toEqual([
      ['libs/a/package.json', 'npm:x@file:libs/a/x-a.tgz'],
      ['libs/a/src/index.ts', 'npm:x@file:libs/a/x-a.tgz'],
    ]);
  });

  it('should not create dependencies from a lockfile that createNodes skipped', async () => {
    write('package.json', JSON.stringify({ devDependencies: { a: '1.0.0' } }));
    write('yarn.lock', yarnLockFile);
    const plugin = await loadPluginInNewProcess();
    expect(
      await createDependencies(
        plugin,
        await createExternalNodes(plugin, 'yarn.lock')
      )
    ).toEqual([{ source: 'npm:a', target: 'npm:x', type: 'static' }]);

    // The workspace switches to pnpm before its first pnpm install.
    write('nx.json', JSON.stringify({ cli: { packageManager: 'pnpm' } }));
    expect(await createExternalNodes(plugin, 'yarn.lock')).toBeUndefined();

    expect(await createDependencies(plugin, {})).toEqual([]);
  });
});
