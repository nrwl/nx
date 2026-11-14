import { vol } from 'memfs';
import type { ProjectGraph } from '../../../config/project-graph';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import {
  getPnpmLockfileDependencies,
  getPnpmLockfileNodes,
  stringifyPnpmLockfile,
} from './pnpm-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { parseAndNormalizePnpmLockfile } from './utils/pnpm-normalizer';

vi.mock('node:fs', async () => {
  const memFs = (await import('memfs')).fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});
vi.mock('../../../utils/workspace-root', () => ({ workspaceRoot: '/root' }));
vi.mock('../../../hasher/file-hasher', () => ({
  hashArray: (values: string[]) => values.join('|'),
}));

function graphFor(content: string): ProjectGraph {
  const { nodes: externalNodes, keyMap } = getPnpmLockfileNodes(
    content,
    content
  );
  const context: CreateDependenciesContext = {
    projects: {},
    externalNodes,
    fileMap: { nonProjectFiles: [], projectFileMap: {} },
    filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
    nxJsonConfiguration: null,
    workspaceRoot: '/root',
  };
  const builder = new ProjectGraphBuilder({
    nodes: {},
    externalNodes,
    dependencies: {},
  });
  for (const dep of getPnpmLockfileDependencies(
    content,
    content,
    context,
    keyMap
  )) {
    builder.addDependency(
      dep.source,
      dep.target,
      dep.type,
      'sourceFile' in dep ? dep.sourceFile : null
    );
  }
  return builder.getUpdatedProjectGraph();
}

describe('pnpm v13 project graph and pruning', () => {
  beforeEach(() => {
    vol.fromJSON({ 'node_modules/.modules.yaml': '{}' }, '/root');
  });
  afterEach(() => {
    vol.reset();
    vi.restoreAllMocks();
  });

  const source = JSON.stringify({
    lockfileVersion: '13.0',
    settings: { autoInstallPeers: false, peersSuffixMaxLength: 3 },
    projects: {
      '.': {
        dependencies: { plugin: '1.0.0', peer: '2.0.0', unused: '1.0.0' },
      },
    },
    packages: {
      'plugin@1.0.0': {
        integrity: 'sha512-plugin',
        peerDependencies: { peer: { specifier: '^2.0.0', version: '2.0.0' } },
        dependencies: { leaf: '3.0.0' },
      },
      'peer@2.0.0': { integrity: 'sha512-peer' },
      'leaf@3.0.0': { integrity: 'sha512-leaf' },
      'unused@1.0.0': { integrity: 'sha512-unused' },
    },
  });

  it('uses integrity hashes and includes transitive and resolved peer edges', () => {
    const warn = vi.spyOn(console, 'warn');
    const graph = graphFor(source);
    expect(graph.externalNodes['npm:plugin']).toMatchObject({
      data: { packageName: 'plugin', version: '1.0.0', hash: 'sha512-plugin' },
    });
    expect(graph.dependencies['npm:plugin']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'npm:peer' }),
        expect.objectContaining({ target: 'npm:leaf' }),
      ])
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('prunes and reparses a v13 lockfile, preserving peers and the bootstrap document', () => {
    const bootstrap = 'packageManagerDependencies: {}\n';
    const content = `---\n${bootstrap}\n---\n${source}`;
    const manifest = {
      name: 'app',
      version: '1.0.0',
      dependencies: { plugin: '1.0.0' },
    };
    const graph = pruneProjectGraph(graphFor(content), manifest);
    expect(Object.keys(graph.externalNodes)).toHaveLength(3);
    const output = stringifyPnpmLockfile(graph, content, manifest, '/root');
    expect(output.startsWith(`---\n${bootstrap}\n---\n`)).toBe(true);
    const normalized = parseAndNormalizePnpmLockfile(output);
    expect(normalized.lockfileVersion).toBe('13.0');
    expect(Object.keys(normalized.importers)).toEqual(['.']);
    expect(Object.keys(normalized.packages)).toHaveLength(3);
    expect(normalized.packages).not.toHaveProperty('unused@1.0.0');
    const reparsed = graphFor(output);
    expect(reparsed.externalNodes).toEqual(graph.externalNodes);
    expect(reparsed.dependencies).toEqual(graph.dependencies);
  });

  it('warns for unsupported future formats', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getPnpmLockfileNodes(
      "lockfileVersion: '14.0'\nimporters: {'.': {}}\npackages: {}\n",
      'future'
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('5-9 and 13'));
  });

  it('keeps the source importer peer variant when pruning a different root scope', () => {
    const content = JSON.stringify({
      lockfileVersion: '13.0',
      settings: { autoInstallPeers: false, peersSuffixMaxLength: 3 },
      projects: {
        '.': { dependencies: { plugin: '1.0.0', peer: '18.0.0' } },
        'apps/other': { dependencies: { plugin: '1.0.0', peer: '19.0.0' } },
      },
      packages: {
        'plugin@1.0.0': {
          integrity: 'sha512-plugin',
          peerDependencies: { peer: '*' },
          snapshots: [
            {
              peerDependencies: { peer: { version: '18.0.0' } },
              dependencies: { leaf: '1.0.0' },
            },
            {
              peerDependencies: { peer: { version: '19.0.0' } },
              dependencies: { leaf: '2.0.0' },
            },
          ],
        },
        'peer@18.0.0': { integrity: 'sha512-peer18' },
        'peer@19.0.0': { integrity: 'sha512-peer19' },
        'leaf@1.0.0': { integrity: 'sha512-leaf1' },
        'leaf@2.0.0': { integrity: 'sha512-leaf2' },
      },
    });
    const manifest = {
      name: 'app',
      version: '1.0.0',
      dependencies: { plugin: '1.0.0', peer: '19.0.0' },
    };
    const graph = pruneProjectGraph(graphFor(content), manifest);
    const output = stringifyPnpmLockfile(graph, content, manifest, '/root');
    const normalized = parseAndNormalizePnpmLockfile(output);
    const selected =
      normalized.packages[
        `plugin@${normalized.importers['.'].dependencies.plugin}`
      ];
    expect(selected.dependencies.peer).toBe('19.0.0');
    expect(selected.dependencies.leaf).toBe('2.0.0');
  });
});
