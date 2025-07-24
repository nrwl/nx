import {
  getBunLockfileNodes,
  getBunLockfileDependencies,
  stringifyBunLockfile,
} from './bun-parser';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
import { ProjectGraph } from '../../../config/project-graph';

describe('Bun Parser', () => {
  const sampleBunLockfile = JSON.stringify({
    lockfileVersion: 0,
    workspaces: {},
    packages: {
      'react@18.2.0': {
        resolution: {
          type: 'version',
          registry: 'https://registry.npmjs.org/',
        },
        dependencies: {
          'loose-envify': '^1.1.0',
        },
        version: '18.2.0',
        name: 'react',
      },
      'loose-envify@1.4.0': {
        resolution: {
          type: 'version',
          registry: 'https://registry.npmjs.org/',
        },
        dependencies: {
          'js-tokens': '^3.0.0 || ^4.0.0',
        },
        version: '1.4.0',
        name: 'loose-envify',
      },
      'js-tokens@4.0.0': {
        resolution: {
          type: 'version',
          registry: 'https://registry.npmjs.org/',
        },
        version: '4.0.0',
        name: 'js-tokens',
      },
    },
  });

  it('should parse Bun lock file and create external nodes', () => {
    const nodes = getBunLockfileNodes(sampleBunLockfile, 'test-hash-1');

    expect(Object.keys(nodes)).toHaveLength(3);
    // With hoisted dependency support, single versions get simplified names
    expect(nodes['npm:react']).toBeDefined();
    expect(nodes['npm:loose-envify']).toBeDefined();
    expect(nodes['npm:js-tokens']).toBeDefined();
  });

  it('should create nodes with correct structure', () => {
    const nodes = getBunLockfileNodes(sampleBunLockfile, 'test-hash-2');
    const reactNode = nodes['npm:react'];

    expect(reactNode).toEqual({
      type: 'npm',
      name: 'npm:react', // Hoisted package doesn't include version in name
      data: {
        version: '18.2.0',
        packageName: 'react',
        hash: expect.any(String),
      },
    });
  });

  it('should handle scoped packages correctly', () => {
    const scopedLockfile = JSON.stringify({
      lockfileVersion: 0,
      packages: {
        '@types/node@18.0.0': {
          resolution: {
            type: 'version',
            registry: 'https://registry.npmjs.org/',
          },
          version: '18.0.0',
          name: '@types/node',
        },
      },
    });

    const nodes = getBunLockfileNodes(scopedLockfile, 'test-hash-3');
    expect(nodes['npm:@types/node']).toBeDefined();
    expect(nodes['npm:@types/node'].data.packageName).toBe('@types/node');
    expect(nodes['npm:@types/node'].data.version).toBe('18.0.0');
  });

  it('should handle empty packages', () => {
    const emptyLockfile = JSON.stringify({
      lockfileVersion: 0,
      packages: {},
    });

    const nodes = getBunLockfileNodes(emptyLockfile, 'test-hash-4');
    expect(Object.keys(nodes)).toHaveLength(0);
  });

  it('should throw error for invalid JSON', () => {
    expect(() => {
      getBunLockfileNodes('invalid json', 'test-hash-5');
    }).toThrow('Failed to get Bun lockfile nodes');
  });

  it('should handle multiple versions of same package', () => {
    const multiVersionLockfile = JSON.stringify({
      lockfileVersion: 0,
      packages: {
        'react@17.0.0': {
          resolution: { type: 'version' },
          version: '17.0.0',
          name: 'react',
        },
        'react@18.2.0': {
          resolution: { type: 'version' },
          version: '18.2.0',
          name: 'react',
        },
      },
    });

    const nodes = getBunLockfileNodes(multiVersionLockfile, 'test-hash-6');
    expect(Object.keys(nodes)).toHaveLength(2);
    // With multiple versions, we don't assume which gets hoisted
    expect(nodes['npm:react@17.0.0']).toBeDefined();
    expect(nodes['npm:react@18.2.0']).toBeDefined();
  });

  it('should skip workspace packages', () => {
    const workspaceLockfile = JSON.stringify({
      lockfileVersion: 0,
      packages: {
        'my-workspace@1.0.0': {
          resolution: {
            type: 'workspace',
            specifier: 'workspace:*',
          },
          version: '1.0.0',
          name: 'my-workspace',
        },
        'react@18.2.0': {
          resolution: { type: 'version' },
          version: '18.2.0',
          name: 'react',
        },
      },
    });

    const nodes = getBunLockfileNodes(workspaceLockfile, 'test-hash-7');
    // Only react should be included, workspace packages are skipped
    expect(Object.keys(nodes)).toHaveLength(1);
    expect(nodes['npm:react']).toBeDefined();
    expect(nodes['npm:my-workspace']).toBeUndefined();
  });

  describe('getBunLockfileDependencies', () => {
    it('should extract dependencies correctly', () => {
      const ctx: CreateDependenciesContext = {
        externalNodes: {
          'npm:react@18.2.0': {
            name: 'npm:react@18.2.0',
            type: 'npm',
            data: { version: '18.2.0', packageName: 'react' },
          },
          'npm:loose-envify@1.4.0': {
            name: 'npm:loose-envify@1.4.0',
            type: 'npm',
            data: { version: '1.4.0', packageName: 'loose-envify' },
          },
          'npm:loose-envify': {
            name: 'npm:loose-envify',
            type: 'npm',
            data: { version: '1.4.0', packageName: 'loose-envify' },
          },
          'npm:js-tokens': {
            name: 'npm:js-tokens',
            type: 'npm',
            data: { version: '4.0.0', packageName: 'js-tokens' },
          },
        },
        projects: {},
        nxJsonConfiguration: {},
        fileMap: { nonProjectFiles: [], projectFileMap: {} },
        filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
        workspaceRoot: '/tmp/test',
      };

      const dependencies = getBunLockfileDependencies(
        sampleBunLockfile,
        'test-hash-deps-1',
        ctx
      );

      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual({
        source: 'npm:react@18.2.0',
        target: 'npm:loose-envify',
        type: 'static',
      });
      expect(dependencies).toContainEqual({
        source: 'npm:loose-envify@1.4.0',
        target: 'npm:js-tokens',
        type: 'static',
      });
    });

    it('should handle all dependency types', () => {
      const allDepsLockfile = JSON.stringify({
        lockfileVersion: 0,
        packages: {
          'package-a@1.0.0': {
            resolution: { type: 'version' },
            version: '1.0.0',
            name: 'package-a',
            dependencies: { 'dep-1': '1.0.0' },
            devDependencies: { 'dep-2': '1.0.0' },
            optionalDependencies: { 'dep-3': '1.0.0' },
            peerDependencies: { 'dep-4': '1.0.0' },
          },
        },
      });

      const ctx: CreateDependenciesContext = {
        externalNodes: {
          'npm:package-a@1.0.0': {
            name: 'npm:package-a@1.0.0',
            type: 'npm',
            data: { version: '1.0.0', packageName: 'package-a' },
          },
          'npm:dep-1': {
            name: 'npm:dep-1',
            type: 'npm',
            data: { version: '1.0.0', packageName: 'dep-1' },
          },
          'npm:dep-2': {
            name: 'npm:dep-2',
            type: 'npm',
            data: { version: '1.0.0', packageName: 'dep-2' },
          },
          'npm:dep-3': {
            name: 'npm:dep-3',
            type: 'npm',
            data: { version: '1.0.0', packageName: 'dep-3' },
          },
          'npm:dep-4': {
            name: 'npm:dep-4',
            type: 'npm',
            data: { version: '1.0.0', packageName: 'dep-4' },
          },
        },
        projects: {},
        nxJsonConfiguration: {},
        fileMap: { nonProjectFiles: [], projectFileMap: {} },
        filesToProcess: { nonProjectFiles: [], projectFileMap: {} },
        workspaceRoot: '/tmp/test',
      };

      const dependencies = getBunLockfileDependencies(
        allDepsLockfile,
        'test-hash-deps-2',
        ctx
      );

      expect(dependencies).toHaveLength(4);
    });
  });

  describe('stringifyBunLockfile', () => {
    it('should serialize lockfile correctly', () => {
      const graph: ProjectGraph = {
        nodes: {},
        externalNodes: {
          'npm:react': {
            type: 'npm',
            name: 'npm:react',
            data: {
              version: '18.2.0',
              packageName: 'react',
              hash: 'test-hash',
            },
          },
        },
        dependencies: {},
      };

      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          react: '^18.2.0',
        },
      };

      const result = stringifyBunLockfile(
        graph,
        sampleBunLockfile,
        packageJson
      );
      const parsed = JSON.parse(result);

      expect(parsed.packages['react@18.2.0']).toBeDefined();
      expect(parsed.lockfileVersion).toBe(1); // Default lockfileVersion is 1
    });
  });
});
