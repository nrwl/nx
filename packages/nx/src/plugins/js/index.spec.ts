import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProjectGraphExternalNode } from '../../config/project-graph';

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
  plugin: Awaited<ReturnType<typeof loadPluginInNewProcess>>
): Promise<Record<string, ProjectGraphExternalNode>> {
  const [, createNodes] = plugin.createNodes;
  const [[, result]] = await createNodes(['pnpm-lock.yaml'], undefined, {
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

describe('nx/js/dependencies-and-lockfile', () => {
  beforeEach(() => {
    write('nx.json', '{}');
    write('node_modules/.modules.yaml', '{"hoistedDependencies": {}}');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should not reuse lockfile dependencies computed against differently named external nodes', async () => {
    writeWorkspace({ a: '1.0.0', b: '1.0.0', x: '1.0.0' });
    // The install has not linked x@1.0.0 at the root yet.
    rmSync(join(root, 'node_modules', 'x'), { recursive: true });
    const first = await loadPluginInNewProcess();
    const firstNodes = await createExternalNodes(first);
    expect(Object.keys(firstNodes)).toContain('npm:x@1.0.0');

    // A second process misses the first's nodes cache and sees x@1.0.0 linked
    // at the root, which renames its node to `npm:x`.
    rmSync(workspaceDataDirectory, { recursive: true });
    write('node_modules/x/package.json', JSON.stringify({ version: '1.0.0' }));
    const second = await loadPluginInNewProcess();
    const secondNodes = await createExternalNodes(second);
    await createDependencies(first, firstNodes);

    expect(await createDependencies(second, secondNodes)).toEqual([
      { source: 'npm:a', target: 'npm:x', type: 'static' },
      { source: 'npm:b', target: 'npm:x@2.0.0', type: 'static' },
    ]);
  });
});
