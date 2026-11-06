import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProjectGraphExternalNode } from '../../config/project-graph';
import {
  localPathPackagesBunLock,
  workspaceNameLocalPathBunLock,
} from './lock-file/__fixtures__/bun/local-path-packages.bun.lock';
import {
  patchedPackagesBunLock,
  unpatchedPackagesBunLock,
} from './lock-file/__fixtures__/bun/patched-packages.bun.lock';
import localPathPackagesPnpmLock from './lock-file/__fixtures__/local-path-packages/pnpm-lock.yaml';

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
  externalNodes: Record<string, ProjectGraphExternalNode>
) {
  return await plugin.createDependencies(undefined, {
    nxJsonConfiguration: {},
    workspaceRoot: root,
    externalNodes,
    projects: {},
    fileMap: { projectFileMap: {}, nonProjectFiles: [] },
    filesToProcess: { projectFileMap: {}, nonProjectFiles: [] },
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

  it('should hash the patch files of patched Bun packages', async () => {
    const dependencies = {
      'is-odd': '1.0.0',
      'odd-alias': 'npm:is-odd@2.0.0',
      'left-pad': '1.1.0',
    };
    const writeBunWorkspace = (
      patchedDependencies: Record<string, string> | undefined
    ) => {
      write(
        'package.json',
        JSON.stringify({ name: 'root', dependencies, patchedDependencies })
      );
      write(
        'bun.lock',
        patchedDependencies ? patchedPackagesBunLock : unpatchedPackagesBunLock
      );
    };
    const hashes = async () => {
      const nodes = await createExternalNodes(
        await loadPluginInNewProcess(),
        'bun.lock'
      );
      return Object.fromEntries(
        ['npm:is-odd@1.0.0', 'npm:odd-alias', 'npm:is-odd@2.0.0'].map(
          (name) => [name, nodes[name].data.hash]
        )
      );
    };
    writeBunWorkspace(undefined);
    const unpatched = await hashes();

    write('patches/is-odd@1.0.0.patch', 'P1');
    write('custom/is-odd@2.0.0.patch', 'A1');
    writeBunWorkspace({
      'is-odd@1.0.0': 'patches/is-odd@1.0.0.patch',
      'is-odd@2.0.0': 'custom/is-odd@2.0.0.patch',
    });
    const patched = await hashes();
    // bun.lock records only the path, so an edit leaves the lockfile as is.
    write('patches/is-odd@1.0.0.patch', 'P2');
    const edited = await hashes();
    rmSync(join(root, 'patches/is-odd@1.0.0.patch'));
    const missing = await hashes();

    for (const name of Object.keys(unpatched)) {
      expect(patched[name]).not.toBe(unpatched[name]);
    }
    expect(edited['npm:is-odd@1.0.0']).not.toBe(patched['npm:is-odd@1.0.0']);
    expect(edited['npm:odd-alias']).toBe(patched['npm:odd-alias']);
    expect(missing['npm:is-odd@1.0.0']).not.toBe(unpatched['npm:is-odd@1.0.0']);
    expect(missing['npm:is-odd@1.0.0']).not.toBe(edited['npm:is-odd@1.0.0']);
    expect(
      (await createExternalNodes(await loadPluginInNewProcess(), 'bun.lock'))[
        'npm:left-pad@1.1.0'
      ].data.hash
    ).toBe(
      'sha512-C8cw/7VpfXLj8Yjlmux8lqb3mfIe3vEXTdik/cXTuzZ8FXJnu45UAWp94XlWWmcW7Yxl74wvHw8w10wIHNGHRQ=='
    );
  });

  it.each([
    ['bun.lock', localPathPackagesBunLock],
    ['pnpm-lock.yaml', localPathPackagesPnpmLock],
  ])(
    'should hash the contents of local path packages in %s',
    async (lockFile, lockFileContent) => {
      write(
        'package.json',
        JSON.stringify({
          name: 'root',
          dependencies: {
            vend: 'file:./vendor/vend',
            ignored: 'file:./vendor/ignored',
            vtar: 'file:./vendor/vtar-1.0.0.tgz',
            lnk: 'link:vendor/lnk',
            alias: 'file:./vendor/real',
          },
        })
      );
      write('.gitignore', 'vendor/ignored\nvendor/vend/dist\n');
      write(lockFile, lockFileContent);
      // `vend` declares the `ttar` tarball. Its ignored dist ships with it.
      const sources = [
        ['vend', 'vendor/vend/index.js'],
        ['vend', 'vendor/vend/dist/index.js'],
        ['ignored', 'vendor/ignored/index.js'],
        ['vtar', 'vendor/vtar-1.0.0.tgz'],
        ['lnk', 'vendor/lnk/index.js'],
        ['ttar', 'vendor/ttar-1.0.0.tgz'],
        ['alias', 'vendor/real/index.js'],
      ];
      const names = [...new Set(sources.map(([name]) => name))];
      for (const [, source] of sources) {
        write(source, 'V1');
      }
      // Every node of a package, so a package that also has a bare node
      // changes only when all of them do.
      const hashes = async () => {
        const plugin = await loadPluginInNewProcess();
        const nodes = await createExternalNodes(plugin, lockFile);
        return Object.fromEntries(
          names.map((name) => [
            name,
            Object.values(nodes)
              .filter((node) => node.data.packageName === name)
              .map((node) => node.data.hash),
          ])
        );
      };
      const before = await hashes();

      for (const [name, source] of sources) {
        write(source, 'V2');
        const after = await hashes();
        write(source, 'V1');

        expect(before[name].length).toBeGreaterThan(0);
        for (const [otherName, otherHashes] of Object.entries(before)) {
          if (otherName === name) {
            for (const [i, hash] of after[name].entries()) {
              expect(hash).not.toBe(otherHashes[i]);
            }
          } else {
            expect(after[otherName]).toEqual(otherHashes);
          }
        }
      }
    }
  );

  // apps/api vendors its own `util`, and apps/web links the workspace `util`.
  it('should hash a vendored package named like a workspace package in bun.lock', async () => {
    write('package.json', JSON.stringify({ name: 'root' }));
    write('bun.lock', workspaceNameLocalPathBunLock);
    write('vendor/util/index.js', 'V1');
    const before = await createExternalNodes(
      await loadPluginInNewProcess(),
      'bun.lock'
    );
    write('vendor/util/index.js', 'V2');
    const after = await createExternalNodes(
      await loadPluginInNewProcess(),
      'bun.lock'
    );

    expect(Object.keys(before)).toEqual(['npm:util@file:vendor/util']);
    expect(after['npm:util@file:vendor/util'].data.hash).not.toBe(
      before['npm:util@file:vendor/util'].data.hash
    );
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
