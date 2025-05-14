import * as tsUtils from './typescript';
import { getDependentPackagesForProject } from './dependencies';

describe('getDependentPackagesForProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should collect npm packages and workspaces libraries without duplicates', () => {
    jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
      '@myorg/lib1': ['libs/lib1/src/index.ts'],
      '@myorg/lib2': ['libs/lib2/src/index.ts'],
    });

    const dependencies = getDependentPackagesForProject(
      {
        dependencies: {
          shell: [
            { source: 'shell', target: 'lib1', type: 'static' },
            { source: 'shell', target: 'lib2', type: 'static' },
            { source: 'shell', target: 'npm:lodash', type: 'static' },
          ],
          lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
          lib2: [{ source: 'lib2', target: 'npm:lodash', type: 'static' }],
        },
        nodes: {
          shell: {
            name: 'shell',
            data: { root: 'apps/shell', sourceRoot: 'apps/shell/src' },
            type: 'app',
          },
          lib1: {
            name: 'lib1',
            data: { root: 'libs/lib1', sourceRoot: 'libs/lib1/src' },
            type: 'lib',
          },
          lib2: {
            name: 'lib2',
            data: { root: 'libs/lib2', sourceRoot: 'libs/lib2/src' },
            type: 'lib',
          },
        } as any,
      },
      'shell'
    );

    expect(dependencies).toEqual({
      workspaceLibraries: [
        { name: 'lib1', root: 'libs/lib1', importKey: '@myorg/lib1' },
        { name: 'lib2', root: 'libs/lib2', importKey: '@myorg/lib2' },
      ],
      npmPackages: ['lodash'],
    });
  });

  it('should collect workspaces libraries recursively', () => {
    jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
      '@myorg/lib1': ['libs/lib1/src/index.ts'],
      '@myorg/lib2': ['libs/lib2/src/index.ts'],
      '@myorg/lib3': ['libs/lib3/src/index.ts'],
    });

    const dependencies = getDependentPackagesForProject(
      {
        dependencies: {
          shell: [{ source: 'shell', target: 'lib1', type: 'static' }],
          lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
          lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        },
        nodes: {
          shell: {
            name: 'shell',
            data: { root: 'apps/shell', sourceRoot: 'apps/shell/src' },
            type: 'app',
          },
          lib1: {
            name: 'lib1',
            data: { root: 'libs/lib1', sourceRoot: 'libs/lib1/src' },
            type: 'lib',
          },
          lib2: {
            name: 'lib2',
            data: { root: 'libs/lib2', sourceRoot: 'libs/lib2/src' },
            type: 'lib',
          },
          lib3: {
            name: 'lib3',
            data: { root: 'libs/lib3', sourceRoot: 'libs/lib3/src' },
            type: 'lib',
          },
        } as any,
      },
      'shell'
    );

    expect(dependencies).toEqual({
      workspaceLibraries: [
        { name: 'lib1', root: 'libs/lib1', importKey: '@myorg/lib1' },
        { name: 'lib2', root: 'libs/lib2', importKey: '@myorg/lib2' },
        { name: 'lib3', root: 'libs/lib3', importKey: '@myorg/lib3' },
      ],
      npmPackages: [],
    });
  });

  it('should ignore TS path mappings with wildcards', () => {
    jest.spyOn(tsUtils, 'readTsPathMappings').mockReturnValue({
      '@myorg/lib1': ['libs/lib1/src/index.ts'],
      '@myorg/lib1/*': ['libs/lib1/src/lib/*'],
      '@myorg/lib2': ['libs/lib2/src/index.ts'],
      '@myorg/lib2/*': ['libs/lib2/src/lib/*'],
      '@myorg/lib3': ['libs/lib3/src/index.ts'],
      '@myorg/lib3/*': ['libs/lib3/src/lib/*'],
    });

    const dependencies = getDependentPackagesForProject(
      {
        dependencies: {
          shell: [{ source: 'shell', target: 'lib1', type: 'static' }],
          lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
          lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        },
        nodes: {
          shell: {
            name: 'shell',
            data: { root: 'apps/shell', sourceRoot: 'apps/shell/src' },
            type: 'app',
          },
          lib1: {
            name: 'lib1',
            data: { root: 'libs/lib1', sourceRoot: 'libs/lib1/src' },
            type: 'lib',
          },
          lib2: {
            name: 'lib2',
            data: { root: 'libs/lib2', sourceRoot: 'libs/lib2/src' },
            type: 'lib',
          },
          lib3: {
            name: 'lib3',
            data: { root: 'libs/lib3', sourceRoot: 'libs/lib3/src' },
            type: 'lib',
          },
        } as any,
      },
      'shell'
    );

    expect(dependencies).toEqual({
      workspaceLibraries: [
        { name: 'lib1', root: 'libs/lib1', importKey: '@myorg/lib1' },
        { name: 'lib2', root: 'libs/lib2', importKey: '@myorg/lib2' },
        { name: 'lib3', root: 'libs/lib3', importKey: '@myorg/lib3' },
      ],
      npmPackages: [],
    });
  });
});
