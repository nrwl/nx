import type { FileData, ProjectGraph } from '@nrwl/devkit';
import {
  DependencyType,
  ProjectType,
} from '@nrwl/workspace/src/core/project-graph';
import { TSESLint } from '@typescript-eslint/experimental-utils';
import * as parser from '@typescript-eslint/parser';
import { vol } from 'memfs';
import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from '../../src/rules/enforce-module-boundaries';
import { TargetProjectLocator } from '@nrwl/workspace/src/core/target-project-locator';
import { mapProjectGraphFiles } from '@nrwl/workspace/src/utils/runtime-lint-utils';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  appRootPath: '/root',
}));

const tsconfig = {
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@mycompany/impl': ['libs/impl/src/index.ts'],
      '@mycompany/untagged': ['libs/untagged/src/index.ts'],
      '@mycompany/api': ['libs/api/src/index.ts'],
      '@mycompany/impl-domain2': ['libs/impl-domain2/src/index.ts'],
      '@mycompany/impl-both-domains': ['libs/impl-both-domains/src/index.ts'],
      '@mycompany/impl2': ['libs/impl2/src/index.ts'],
      '@mycompany/other': ['libs/other/src/index.ts'],
      '@mycompany/other/a/b': ['libs/other/src/a/b.ts'],
      '@mycompany/other/a': ['libs/other/src/a/index.ts'],
      '@mycompany/another/a/b': ['libs/another/a/b.ts'],
      '@mycompany/myapp': ['apps/myapp/src/index.ts'],
      '@mycompany/myapp-e2e': ['apps/myapp-e2e/src/index.ts'],
      '@mycompany/mylib': ['libs/mylib/src/index.ts'],
      '@mycompany/mylibName': ['libs/mylibName/src/index.ts'],
      '@mycompany/public': ['libs/public/src/index.ts'],
      '@mycompany/dependsOnPrivate': ['libs/dependsOnPrivate/src/index.ts'],
      '@mycompany/dependsOnPrivate2': ['libs/dependsOnPrivate2/src/index.ts'],
      '@mycompany/private': ['libs/private/src/index.ts'],
      '@mycompany/anotherlibName': ['libs/anotherlibName/src/index.ts'],
      '@mycompany/badcirclelib': ['libs/badcirclelib/src/index.ts'],
      '@mycompany/domain1': ['libs/domain1/src/index.ts'],
      '@mycompany/domain2': ['libs/domain2/src/index.ts'],
      '@mycompany/buildableLib': ['libs/buildableLib/src/main.ts'],
      '@nonBuildableScope/nonBuildableLib': [
        'libs/nonBuildableLib/src/main.ts',
      ],
    },
    types: ['node'],
  },
  exclude: ['**/*.spec.ts'],
  include: ['**/*.ts'],
};

const packageJson = {
  dependencies: {
    'npm-package': '2.3.4',
  },
  devDependencies: {
    'npm-awesome-package': '1.2.3',
  },
};

const fileSys = {
  './libs/impl/src/index.ts': '',
  './libs/untagged/src/index.ts': '',
  './libs/api/src/index.ts': '',
  './libs/impl-domain2/src/index.ts': '',
  './libs/impl-both-domains/src/index.ts': '',
  './libs/impl2/src/index.ts': '',
  './libs/other/src/index.ts': '',
  './libs/other/src/a/b.ts': '',
  './libs/other/src/a/index.ts': '',
  './libs/another/a/b.ts': '',
  './apps/myapp/src/index.ts': '',
  './libs/mylib/src/index.ts': '',
  './libs/mylibName/src/index.ts': '',
  './libs/anotherlibName/src/index.ts': '',
  './libs/badcirclelib/src/index.ts': '',
  './libs/domain1/src/index.ts': '',
  './libs/domain2/src/index.ts': '',
  './libs/buildableLib/src/main.ts': '',
  './libs/nonBuildableLib/src/main.ts': '',
  './libs/public/src/index.ts': '',
  './libs/dependsOnPrivate/src/index.ts': '',
  './libs/dependsOnPrivate2/src/index.ts': '',
  './libs/private/src/index.ts': '',
  './tsconfig.base.json': JSON.stringify(tsconfig),
  './package.json': JSON.stringify(packageJson),
  './nx.json': JSON.stringify({ npmScope: 'happyorg' }),
};

describe('Enforce Module Boundaries (eslint)', () => {
  beforeEach(() => {
    vol.fromJSON(fileSys, '/root');
  });

  it('should not error when everything is in order', () => {
    const failures = runRule(
      { allow: ['@mycompany/mylib/deep'] },
      `${process.cwd()}/proj/apps/myapp/src/main.ts`,
      `
        import '@mycompany/mylib';
        import '@mycompany/mylib/deep';
        import '../blah';
        import('@mycompany/mylib');
        import('@mycompany/mylib/deep');
        import('../blah');
      `,
      {
        nodes: {
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'libs/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`apps/myapp/src/main.ts`),
                createFile(`apps/myapp/blah.ts`),
              ],
            },
          },
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`libs/mylib/src/index.ts`),
                createFile(`libs/mylib/src/deep.ts`),
              ],
            },
          },
        },
        dependencies: {},
      }
    );

    expect(failures.length).toEqual(0);
  });

  it('should handle multiple projects starting with the same prefix properly', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/apps/myapp/src/main.ts`,
      `
        import '@mycompany/myapp2/mylib';
        import('@mycompany/myapp2/mylib');
      `,
      {
        nodes: {
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'libs/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`apps/myapp/src/main.ts`),
                createFile(`apps/myapp/src/blah.ts`),
              ],
            },
          },
          myapp2Name: {
            name: 'myapp2Name',
            type: ProjectType.app,
            data: {
              root: 'libs/myapp2',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [],
            },
          },
          'myapp2-mylib': {
            name: 'myapp2-mylib',
            type: ProjectType.lib,
            data: {
              root: 'libs/myapp2/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile('libs/myapp2/mylib/src/index.ts')],
            },
          },
        },
        dependencies: {},
      }
    );

    expect(failures.length).toEqual(0);
  });

  describe('depConstraints', () => {
    const graph: ProjectGraph = {
      nodes: {
        apiName: {
          name: 'apiName',
          type: ProjectType.lib,
          data: {
            root: 'libs/api',
            tags: ['api', 'domain1'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/api/src/index.ts`)],
          },
        },
        'impl-both-domainsName': {
          name: 'impl-both-domainsName',
          type: ProjectType.lib,
          data: {
            root: 'libs/impl-both-domains',
            tags: ['impl', 'domain1', 'domain2'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/impl-both-domains/src/index.ts`)],
          },
        },
        'impl-domain2Name': {
          name: 'impl-domain2Name',
          type: ProjectType.lib,
          data: {
            root: 'libs/impl-domain2',
            tags: ['impl', 'domain2'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/impl-domain2/src/index.ts`)],
          },
        },
        impl2Name: {
          name: 'impl2Name',
          type: ProjectType.lib,
          data: {
            root: 'libs/impl2',
            tags: ['impl', 'domain1'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/impl2/src/index.ts`)],
          },
        },
        implName: {
          name: 'implName',
          type: ProjectType.lib,
          data: {
            root: 'libs/impl',
            tags: ['impl', 'domain1'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/impl/src/index.ts`)],
          },
        },
        publicName: {
          name: 'publicName',
          type: ProjectType.lib,
          data: {
            root: 'libs/public',
            tags: ['public'],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/public/src/index.ts`)],
          },
        },
        dependsOnPrivateName: {
          name: 'dependsOnPrivateName',
          type: ProjectType.lib,
          data: {
            root: 'libs/dependsOnPrivate',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: [
              createFile(`libs/dependsOnPrivate/src/index.ts`, ['privateName']),
            ],
          },
        },
        dependsOnPrivateName2: {
          name: 'dependsOnPrivateName2',
          type: ProjectType.lib,
          data: {
            root: 'libs/dependsOnPrivate2',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: [
              createFile(`libs/dependsOnPrivate2/src/index.ts`, [
                'privateName',
              ]),
            ],
          },
        },
        privateName: {
          name: 'privateName',
          type: ProjectType.lib,
          data: {
            root: 'libs/private',
            tags: ['private'],
            implicitDependencies: [],
            architect: {},
            files: [
              createFile(
                `libs/private/src/index.tslibs/private/src/index.tslibs/private/src/index.ts`
              ),
            ],
          },
        },
        untaggedName: {
          name: 'untaggedName',
          type: ProjectType.lib,
          data: {
            root: 'libs/untagged',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: [createFile(`libs/untagged/src/index.ts`)],
          },
        },
      },
      externalNodes: {
        'npm:npm-package': {
          name: 'npm:npm-package',
          type: 'npm',
          data: {
            packageName: 'npm-package',
            version: '2.3.4',
          },
        },
        'npm:npm-package2': {
          name: 'npm:npm-package2',
          type: 'npm',
          data: {
            packageName: 'npm-package2',
            version: '0.0.0',
          },
        },
        'npm:1npm-package': {
          name: 'npm:1npm-package',
          type: 'npm',
          data: {
            packageName: '1npm-package',
            version: '0.0.0',
          },
        },
        'npm:npm-awesome-package': {
          name: 'npm:npm-awesome-package',
          type: 'npm',
          data: {
            packageName: 'npm-awesome-package',
            version: '1.2.3',
          },
        },
      },
      dependencies: {
        dependsOnPrivateName: [
          {
            source: 'dependsOnPrivateName',
            target: 'privateName',
            type: DependencyType.static,
          },
        ],
        dependsOnPrivateName2: [
          {
            source: 'dependsOnPrivateName2',
            target: 'privateName',
            type: DependencyType.static,
          },
        ],
      },
    };

    const depConstraints = {
      depConstraints: [
        { sourceTag: 'api', onlyDependOnLibsWithTags: ['api'] },
        { sourceTag: 'impl', onlyDependOnLibsWithTags: ['api', 'impl'] },
        { sourceTag: 'domain1', onlyDependOnLibsWithTags: ['domain1'] },
        { sourceTag: 'domain2', onlyDependOnLibsWithTags: ['domain2'] },
        { sourceTag: 'public', notDependOnLibsWithTags: ['private'] },
      ],
    };

    beforeEach(() => {
      vol.fromJSON(fileSys, '/root');
    });

    it('should error when the target library does not have the right tag', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import '@mycompany/impl';
          import('@mycompany/impl');
        `,
        graph
      );

      const message =
        'A project tagged with "api" can only depend on libs tagged with "api"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should allow imports of npm packages', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });

    it('should error when importing forbidden npm packages', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', bannedExternalImports: ['npm-package'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
        `,
        graph
      );

      const message =
        'A project tagged with "api" is not allowed to import the "npm-package" package';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when importing transitive npm packages', () => {
      const failures = runRule(
        {
          ...depConstraints,
          banTransitiveDependencies: true,
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package2';
          import('npm-package2');
        `,
        graph
      );

      const message =
        'Transitive dependencies are not allowed. Only packages defined in the "package.json" can be imported';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when importing direct npm dependencies', () => {
      const failures = runRule(
        {
          ...depConstraints,
          banTransitiveDependencies: true,
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
          import 'npm-awesome-package';
          import('npm-awesome-package');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });

    it('should allow wildcards for defining forbidden npm packages', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', bannedExternalImports: ['npm-*ge'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import 'npm-awesome-package';
          import 'npm-package2';
          import '1npm-package';
        `,
        graph
      );

      const message = (packageName) =>
        `A project tagged with "api" is not allowed to import the "${packageName}" package`;
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message('npm-package'));
      expect(failures[1].message).toEqual(message('npm-awesome-package'));
    });

    it('should error when the target library is untagged', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import '@mycompany/untagged';
          import('@mycompany/untagged');
        `,
        graph
      );

      const message =
        'A project tagged with "api" can only depend on libs tagged with "api"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when the target library has a disallowed tag', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/public/src/index.ts`,
        `
          import '@mycompany/private';
          import('@mycompany/private');
        `,
        {
          ...graph,
          dependencies: {
            ...graph.dependencies,
            publicName: [
              {
                source: 'publicName',
                target: 'privateName',
                type: DependencyType.static,
              },
            ],
          },
        }
      );

      const message = `A project tagged with "public" can not depend on libs tagged with "private"

Violation detected in:
- privateName`;
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when there is a disallowed tag in the dependency tree', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/public/src/index.ts`,
        `
          import '@mycompany/dependsOnPrivate';
          import '@mycompany/dependsOnPrivate2';
          import '@mycompany/private';
        `,
        {
          ...graph,
          dependencies: {
            ...graph.dependencies,
            publicName: [
              {
                source: 'publicName',
                target: 'dependsOnPrivateName',
                type: DependencyType.static,
              },
              {
                source: 'publicName',
                target: 'dependsOnPrivateName2',
                type: DependencyType.static,
              },
              {
                source: 'publicName',
                target: 'privateName',
                type: DependencyType.static,
              },
            ],
          },
        }
      );

      expect(failures.length).toEqual(3);
      // TODO: Add project dependency path to message
      const message = (
        prefix
      ) => `A project tagged with "public" can not depend on libs tagged with "private"

Violation detected in:
- ${prefix}privateName`;
      expect(failures[0].message).toEqual(message('dependsOnPrivateName -> '));
      expect(failures[1].message).toEqual(message('dependsOnPrivateName2 -> '));
      expect(failures[2].message).toEqual(message(''));
    });

    it('should error when the source library is untagged', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/untagged/src/index.ts`,
        `
          import '@mycompany/api';
          import('@mycompany/api');
        `,
        graph
      );

      const message =
        'A project without tags matching at least one constraint cannot depend on any libraries';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should check all tags', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
        `
          import '@mycompany/impl-domain2';
          import('@mycompany/impl-domain2');
        `,
        graph
      );

      const message =
        'A project tagged with "domain1" can only depend on libs tagged with "domain1"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should allow a domain1 project to depend on a project that is tagged with domain1 and domain2', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
        `
          import '@mycompany/impl-both-domains';
          import('@mycompany/impl-both-domains');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });

    it('should allow a domain1/domain2 project depend on domain1', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl-both-domain/src/index.ts`,
        `
          import '@mycompany/impl';
          import('@mycompany/impl');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });

    it('should not error when the constraints are satisfied', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
        `
          import '@mycompany/impl2';
          import('@mycompany/impl2');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });

    it('should support wild cards', () => {
      const failures = runRule(
        {
          depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import '@mycompany/impl';
          import('@mycompany/impl');
        `,
        graph
      );

      expect(failures.length).toEqual(0);
    });
  });

  describe('relative imports', () => {
    it('should not error when relatively importing the same library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        `
          import '../other';
          import('../other');
        `,
        {
          nodes: {
            mylibName: {
              name: 'mylibName',
              type: ProjectType.lib,
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [
                  createFile(`libs/mylib/src/main.ts`),
                  createFile(`libs/mylib/other.ts`),
                ],
              },
            },
          },
          dependencies: {},
        }
      );
      expect(failures.length).toEqual(0);
    });

    it('should not error when relatively importing the same library (index file)', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        `
          import '../other';
          import('../other');
        `,
        {
          nodes: {
            mylibName: {
              name: 'mylibName',
              type: ProjectType.lib,
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [
                  createFile(`libs/mylib/src/main.ts`),
                  createFile(`libs/mylib/other/index.ts`),
                ],
              },
            },
          },
          dependencies: {},
        }
      );
      expect(failures.length).toEqual(0);
    });

    it('should error when relatively importing another library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        `
          import '../../other';
          import('../../other');
        `,
        {
          nodes: {
            mylibName: {
              name: 'mylibName',
              type: ProjectType.lib,
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile(`libs/mylib/src/main.ts`)],
              },
            },
            otherName: {
              name: 'otherName',
              type: ProjectType.lib,
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/other/src/index.ts')],
              },
            },
          },
          dependencies: {},
        }
      );

      const message =
        'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when relatively importing the src directory of another library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        `
          import '../../other/src';
          import('../../other/src');
        `,
        {
          nodes: {
            mylibName: {
              name: 'mylibName',
              type: ProjectType.lib,
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile(`libs/mylib/src/main.ts`)],
              },
            },
            otherName: {
              name: 'otherName',
              type: ProjectType.lib,
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/other/src/index.ts')],
              },
            },
          },
          dependencies: {},
        }
      );

      const message =
        'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });
  });

  it('should error on absolute imports into libraries without using the npm scope', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import 'libs/src/other';
        import('libs/src/other');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`libs/mylib/src/main.ts`),
                createFile(`libs/mylib/src/other.ts`),
              ],
            },
          },
        },
        dependencies: {},
      }
    );

    const message =
      'Projects cannot be imported by a relative or absolute path, and must begin with a npm scope';
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  it('should respect regexp in allow option', () => {
    const failures = runRule(
      { allow: ['^.*/utils/.*$'] },
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '../../utils/a';
        import('../../utils/a');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`)],
            },
          },
          utils: {
            name: 'utils',
            type: ProjectType.lib,
            data: {
              root: 'libs/utils',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/utils/a.ts`)],
            },
          },
        },
        dependencies: {},
      }
    );

    expect(failures.length).toEqual(0);
  });

  it.each`
    importKind | shouldError | importStatement
    ${'value'} | ${true}     | ${'import { someValue } from "@mycompany/other";'}
    ${'type'}  | ${false}    | ${'import type { someType } from "@mycompany/other";'}
  `(
    `when importing a lazy-loaded library:
    \t importKind: $importKind
    \t shouldError: $shouldError`,
    ({ importKind, importStatement }) => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        importStatement,
        {
          nodes: {
            mylibName: {
              name: 'mylibName',
              type: ProjectType.lib,
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile(`libs/mylib/src/main.ts`)],
              },
            },
            otherName: {
              name: 'otherName',
              type: ProjectType.lib,
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile(`libs/other/index.ts`)],
              },
            },
          },
          dependencies: {
            mylibName: [
              {
                source: 'mylibName',
                target: 'otherName',
                type: DependencyType.dynamic,
              },
            ],
          },
        }
      );
      if (importKind === 'type') {
        expect(failures.length).toEqual(0);
      } else {
        expect(failures[0].message).toEqual(
          'Imports of lazy-loaded libraries are forbidden'
        );
      }
    }
  );

  it('should error on importing an app', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '@mycompany/myapp';
        import('@mycompany/myapp');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`)],
            },
          },
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp/src/index.ts`)],
            },
          },
        },
        dependencies: {},
      }
    );

    const message = 'Imports of apps are forbidden';
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  it('should error on importing an e2e project', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '@mycompany/myapp-e2e';
        import('@mycompany/myapp-e2e');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`)],
            },
          },
          myappE2eName: {
            name: 'myappE2eName',
            type: ProjectType.e2e,
            data: {
              root: 'apps/myapp-e2e',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp-e2e/src/index.ts`)],
            },
          },
        },
        dependencies: {},
      }
    );

    const message = 'Imports of e2e projects are forbidden';
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  it('should error when absolute path within project detected', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '@mycompany/mylib';
        import('@mycompany/mylib');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`)],
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/anotherlib/src/main.ts`)],
            },
          },
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp/src/index.ts`)],
            },
          },
        },
        dependencies: {
          mylibName: [
            {
              source: 'mylibName',
              target: 'anotherlibName',
              type: DependencyType.static,
            },
          ],
        },
      }
    );

    const message =
      'Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "@mycompany/mylib"';
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  it('should ignore detected absolute path within project if allowCircularSelfDependency flag is set', () => {
    const failures = runRule(
      {
        allowCircularSelfDependency: true,
      },
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '@mycompany/mylib';
        import('@mycompany/mylib');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`)],
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/anotherlib/src/main.ts`)],
            },
          },
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp/src/index.ts`)],
            },
          },
        },
        dependencies: {
          mylibName: [
            {
              source: 'mylibName',
              target: 'anotherlibName',
              type: DependencyType.static,
            },
          ],
        },
      }
    );

    expect(failures.length).toBe(0);
  });

  it('should error when circular dependency detected', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/anotherlib/src/main.ts`,
      `
        import '@mycompany/mylib';
        import('@mycompany/mylib');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/mylib/src/main.ts`, ['anotherlibName'])],
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`libs/anotherlib/src/main.ts`, ['mylibName'])],
            },
          },
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp/src/index.ts`)],
            },
          },
        },
        dependencies: {
          mylibName: [
            {
              source: 'mylibName',
              target: 'anotherlibName',
              type: DependencyType.static,
            },
          ],
        },
      }
    );

    const message = `Circular dependency between "anotherlibName" and "mylibName" detected: anotherlibName -> mylibName -> anotherlibName

Circular file chain:
- libs/anotherlib/src/main.ts
- libs/mylib/src/main.ts`;
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  it('should error when circular dependency detected (indirect)', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      `
        import '@mycompany/badcirclelib';
        import('@mycompany/badcirclelib');
      `,
      {
        nodes: {
          mylibName: {
            name: 'mylibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`libs/mylib/src/main.ts`, ['badcirclelibName']),
              ],
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`libs/anotherlib/src/main.ts`, ['mylibName']),
                createFile(`libs/anotherlib/src/index.ts`, ['mylibName']),
              ],
            },
          },
          badcirclelibName: {
            name: 'badcirclelibName',
            type: ProjectType.lib,
            data: {
              root: 'libs/badcirclelib',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [
                createFile(`libs/badcirclelib/src/main.ts`, ['anotherlibName']),
              ],
            },
          },
          myappName: {
            name: 'myappName',
            type: ProjectType.app,
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              architect: {},
              files: [createFile(`apps/myapp/index.ts`)],
            },
          },
        },
        dependencies: {
          mylibName: [
            {
              source: 'mylibName',
              target: 'badcirclelibName',
              type: DependencyType.static,
            },
          ],
          badcirclelibName: [
            {
              source: 'badcirclelibName',
              target: 'anotherlibName',
              type: DependencyType.static,
            },
          ],
          anotherlibName: [
            {
              source: 'anotherlibName',
              target: 'mylibName',
              type: DependencyType.static,
            },
          ],
        },
      }
    );

    const message = `Circular dependency between "mylibName" and "badcirclelibName" detected: mylibName -> badcirclelibName -> anotherlibName -> mylibName

Circular file chain:
- libs/mylib/src/main.ts
- libs/badcirclelib/src/main.ts
- [
    libs/anotherlib/src/main.ts,
    libs/anotherlib/src/index.ts
  ]`;
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toEqual(message);
    expect(failures[1].message).toEqual(message);
  });

  describe('buildable library imports', () => {
    it('should ignore the buildable library verification if the enforceBuildableLibDependency is set to false', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: false,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          import '@mycompany/nonBuildableLib';
          import('@mycompany/nonBuildableLib');
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile(`libs/nonBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });

    it('should error when buildable libraries import non-buildable libraries', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          import '@nonBuildableScope/nonBuildableLib';
          import('@nonBuildableScope/nonBuildableLib');
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
                files: [createFile(`libs/nonBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      const message =
        'Buildable libraries cannot import or export from non-buildable libraries';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when buildable libraries import another buildable libraries', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          import '@mycompany/anotherBuildableLib';
          import('@mycompany/anotherBuildableLib');
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/anotherBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });

    it('should ignore the buildable library verification if no architect is specified', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          import '@mycompany/nonBuildableLib';
          import('@mycompany/nonBuildableLib');
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                files: [createFile(`libs/nonBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });

    it('should error when exporting all from a non-buildable library', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          export * from '@nonBuildableScope/nonBuildableLib';
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
                files: [createFile(`libs/nonBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      const message =
        'Buildable libraries cannot import or export from non-buildable libraries';
      expect(failures[0].message).toEqual(message);
    });

    it('should not error when exporting all from a buildable library', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          export * from '@mycompany/anotherBuildableLib';
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/anotherBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });

    it('should error when exporting a named resource from a non-buildable library', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          export { foo } from '@nonBuildableScope/nonBuildableLib';
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
                files: [createFile(`libs/nonBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      const message =
        'Buildable libraries cannot import or export from non-buildable libraries';
      expect(failures[0].message).toEqual(message);
    });

    it('should not error when exporting a named resource from a buildable library', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          export { foo } from '@mycompany/anotherBuildableLib';
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/anotherBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });

    it('should not error when in-line exporting a named resource', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
        },
        `${process.cwd()}/proj/libs/buildableLib/src/main.ts`,
        `
          export class Foo {};
        `,
        {
          nodes: {
            buildableLib: {
              name: 'buildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/buildableLib/src/main.ts`)],
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: ProjectType.lib,
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                architect: {
                  build: {
                    // defines a buildable lib
                    builder: '@angular-devkit/build-ng-packagr:build',
                  },
                },
                files: [createFile(`libs/anotherBuildableLib/src/main.ts`)],
              },
            },
          },
          dependencies: {},
        }
      );

      expect(failures.length).toBe(0);
    });
  });
});

const linter = new TSESLint.Linter();
const baseConfig = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018 as const,
    sourceType: 'module' as const,
  },
  rules: {
    [enforceModuleBoundariesRuleName]: 'error',
  },
};
linter.defineParser('@typescript-eslint/parser', parser);
linter.defineRule(enforceModuleBoundariesRuleName, enforceModuleBoundaries);

function createFile(f: string, deps?: string[]): FileData {
  return { file: f, hash: '', ...(deps && { deps }) };
}

function runRule(
  ruleArguments: any,
  contentPath: string,
  content: string,
  projectGraph: ProjectGraph
): TSESLint.Linter.LintMessage[] {
  (global as any).projectPath = `${process.cwd()}/proj`;
  (global as any).npmScope = 'mycompany';
  (global as any).projectGraph = mapProjectGraphFiles(projectGraph);
  (global as any).targetProjectLocator = new TargetProjectLocator(
    projectGraph.nodes,
    projectGraph.externalNodes
  );

  const config = {
    ...baseConfig,
    rules: {
      [enforceModuleBoundariesRuleName]: ['error', ruleArguments],
    },
  };

  return linter.verify(content, config as any, contentPath);
}
