import 'nx/src/utils/testing/mock-fs';

import type { FileData, ProjectFileMap, ProjectGraph } from '@nx/devkit';
import { DependencyType } from '@nx/devkit';
import * as parser from '@typescript-eslint/parser';
import { TSESLint } from '@typescript-eslint/utils';
import { vol } from 'memfs';
import { TargetProjectLocator } from '@nx/js/src/internal';
import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from '../../src/rules/enforce-module-boundaries';
import { createProjectRootMappings } from 'nx/src/project-graph/utils/find-project-for-path';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

const tsconfig = {
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@mycompany/impl': ['libs/impl/src/index.ts'],
      '@mycompany/untagged': ['libs/untagged/src/index.ts'],
      '@mycompany/tagged': ['libs/tagged/src/index.ts'],
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
      '@mycompany/buildableLib2': ['libs/buildableLib2/src/main.ts'],
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
  './libs/tagged/src/index.ts': '',
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
  './libs/buildableLib2/src/main.ts': '',
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
            type: 'app',
            data: {
              root: 'libs/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          mylibName: {
            name: 'mylibName',
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        myappName: [
          createFile(`apps/myapp/src/main.ts`),
          createFile(`apps/myapp/blah.ts`),
        ],
        mylibName: [
          createFile(`libs/mylib/src/index.ts`),
          createFile(`libs/mylib/src/deep.ts`),
        ],
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
            type: 'app',
            data: {
              root: 'libs/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myapp2Name: {
            name: 'myapp2Name',
            type: 'app',
            data: {
              root: 'libs/myapp2',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          'myapp2-mylib': {
            name: 'myapp2-mylib',
            type: 'lib',
            data: {
              root: 'libs/myapp2/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        myappName: [
          createFile(`apps/myapp/src/main.ts`),
          createFile(`apps/myapp/src/blah.ts`),
        ],
        myapp2Name: [],
        'myapp2-mylib': [createFile('libs/myapp2/mylib/src/index.ts')],
      }
    );

    expect(failures.length).toEqual(0);
  });

  describe('depConstraints', () => {
    const fileMap = {
      apiName: [createFile(`libs/api/src/index.ts`)],
      'impl-both-domainsName': [
        createFile(`libs/impl-both-domains/src/index.ts`),
      ],
      'impl-domain2Name': [createFile(`libs/impl-domain2/src/index.ts`)],
      impl2Name: [createFile(`libs/impl2/src/index.ts`)],
      implName: [createFile(`libs/impl/src/index.ts`)],
      publicName: [createFile(`libs/public/src/index.ts`)],
      dependsOnPrivateName: [
        createFile(`libs/dependsOnPrivate/src/index.ts`, ['privateName']),
      ],
      dependsOnPrivateName2: [
        createFile(`libs/dependsOnPrivate2/src/index.ts`, ['privateName']),
      ],
      privateName: [
        createFile(`libs/private/src/index.ts`, ['untaggedName', 'taggedName']),
      ],
      untaggedName: [createFile(`libs/untagged/src/index.ts`)],
      taggedName: [createFile(`libs/tagged/src/index.ts`)],
    };

    const graph: ProjectGraph = {
      nodes: {
        apiName: {
          name: 'apiName',
          type: 'lib',
          data: {
            root: 'libs/api',
            tags: ['api', 'domain1'],
            implicitDependencies: [],
            targets: {},
          },
        },
        'impl-both-domainsName': {
          name: 'impl-both-domainsName',
          type: 'lib',
          data: {
            root: 'libs/impl-both-domains',
            tags: ['impl', 'domain1', 'domain2'],
            implicitDependencies: [],
            targets: {},
          },
        },
        'impl-domain2Name': {
          name: 'impl-domain2Name',
          type: 'lib',
          data: {
            root: 'libs/impl-domain2',
            tags: ['impl', 'domain2'],
            implicitDependencies: [],
            targets: {},
          },
        },
        impl2Name: {
          name: 'impl2Name',
          type: 'lib',
          data: {
            root: 'libs/impl2',
            tags: ['impl', 'domain1'],
            implicitDependencies: [],
            targets: {},
          },
        },
        implName: {
          name: 'implName',
          type: 'lib',
          data: {
            root: 'libs/impl',
            tags: ['impl', 'domain1'],
            implicitDependencies: [],
            targets: {},
          },
        },
        publicName: {
          name: 'publicName',
          type: 'lib',
          data: {
            root: 'libs/public',
            tags: ['public'],
            implicitDependencies: [],
            targets: {},
          },
        },
        dependsOnPrivateName: {
          name: 'dependsOnPrivateName',
          type: 'lib',
          data: {
            root: 'libs/dependsOnPrivate',
            tags: [],
            implicitDependencies: [],
            targets: {},
          },
        },
        dependsOnPrivateName2: {
          name: 'dependsOnPrivateName2',
          type: 'lib',
          data: {
            root: 'libs/dependsOnPrivate2',
            tags: [],
            implicitDependencies: [],
            targets: {},
          },
        },
        privateName: {
          name: 'privateName',
          type: 'lib',
          data: {
            root: 'libs/private',
            tags: ['private'],
            implicitDependencies: [],
            targets: {},
          },
        },
        untaggedName: {
          name: 'untaggedName',
          type: 'lib',
          data: {
            root: 'libs/untagged',
            tags: [],
            implicitDependencies: [],
            targets: {},
          },
        },
        taggedName: {
          name: 'taggedName',
          type: 'lib',
          data: {
            root: 'libs/tagged',
            tags: ['some-tag'],
            implicitDependencies: [],
            targets: {},
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
        { sourceTag: 'private', onlyDependOnLibsWithTags: [] },
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" is not allowed to import "npm-package"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when importing npm packages matching allowed external imports', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', allowedExternalImports: ['npm-package'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should error when importing npm packages not matching allowed external imports', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', allowedExternalImports: ['npm-package'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-awesome-package';
          import('npm-awesome-package');
        `,
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" is not allowed to import "npm-awesome-package"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when importing npm packages matching allowed glob pattern', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', allowedExternalImports: ['npm-awesome-*'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-awesome-package';
          import('npm-awesome-package');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should error when importing npm packages not matching allowed glob pattern', () => {
      const failures = runRule(
        {
          depConstraints: [
            { sourceTag: 'api', allowedExternalImports: ['npm-awesome-*'] },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
        `,
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" is not allowed to import "npm-package"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when importing any npm package if none is allowed', () => {
      const failures = runRule(
        {
          depConstraints: [{ sourceTag: 'api', allowedExternalImports: [] }],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package';
          import('npm-package');
        `,
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" is not allowed to import "npm-package"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when importing package nested allowed route', () => {
      const failures = runRule(
        {
          depConstraints: [
            {
              sourceTag: 'api',
              allowedExternalImports: ['npm-package/*'],
              bannedExternalImports: ['npm-package/testing'],
            },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package/allowed';
          import('npm-package/allowed');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should error when importing package nested forbidden route', () => {
      const failures = runRule(
        {
          depConstraints: [
            {
              sourceTag: 'api',
              allowedExternalImports: ['npm-package/*'],
              bannedExternalImports: ['npm-package/testing'],
            },
          ],
        },
        `${process.cwd()}/proj/libs/api/src/index.ts`,
        `
          import 'npm-package/testing';
          import('npm-package/testing');
        `,
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" is not allowed to import "npm-package/testing"';
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
      );

      const message = (packageName) =>
        `A project tagged with "api" is not allowed to import "${packageName}"`;
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
        graph,
        fileMap
      );

      const message =
        'A project tagged with "api" can only depend on libs tagged with "api"';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should not error when the target library is untagged, if source expects it', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/private/src/index.ts`,
        `
          import '@mycompany/untagged';
          import('@mycompany/untagged');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should error when the target library is tagged, if source does not expect it', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/private/src/index.ts`,
        `
          import '@mycompany/tagged';
          import('@mycompany/tagged');
        `,
        graph,
        fileMap
      );

      const message =
        'A project tagged with "private" cannot depend on any libs with tags';
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
        },
        fileMap
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
        },
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
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
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should support globs', () => {
      const failures = runRule(
        {
          depConstraints: [
            {
              sourceTag: 'p*',
              onlyDependOnLibsWithTags: ['domain*'],
            },
          ],
        },
        `${process.cwd()}/proj/libs/public/src/index.ts`,
        `
          import '@mycompany/impl-domain2';
          import('@mycompany/impl-domain2');
          import '@mycompany/impl-both-domains';
          import('@mycompany/impl-both-domains');
          import '@mycompany/impl';
          import('@mycompany/impl');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(0);
    });

    it('should report errors for combo source tags', () => {
      const failures = runRule(
        {
          depConstraints: [
            {
              allSourceTags: ['impl', 'domain1'],
              onlyDependOnLibsWithTags: ['impl'],
            },
            { sourceTag: 'impl', onlyDependOnLibsWithTags: ['api'] },
          ],
        },
        // ['impl', 'domain1']
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
        // ['impl', 'domain1', 'domain2']
        `
          import '@mycompany/api';
          import('@mycompany/api');
        `,
        graph,
        fileMap
      );

      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(
        'A project tagged with "impl" and "domain1" can only depend on libs tagged with "impl"'
      );
      expect(failures[1].message).toEqual(
        'A project tagged with "impl" and "domain1" can only depend on libs tagged with "impl"'
      );
    });

    it('should properly map combo source tags', () => {
      const failures = runRule(
        {
          depConstraints: [
            {
              allSourceTags: ['impl', 'domain1'],
              onlyDependOnLibsWithTags: ['api'],
            },
          ],
        },
        // ['impl', 'domain1']
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
        // ['impl', 'domain1', 'domain2']
        `
          import '@mycompany/api';
          import('@mycompany/api');
        `,
        graph,
        fileMap
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
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          mylibName: [
            createFile(`libs/mylib/src/main.ts`),
            createFile(`libs/mylib/other.ts`),
          ],
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
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          mylibName: [
            createFile(`libs/mylib/src/main.ts`),
            createFile(`libs/mylib/other/index.ts`),
          ],
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
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
            otherName: {
              name: 'otherName',
              type: 'lib',
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          mylibName: [createFile(`libs/mylib/src/main.ts`)],
          otherName: [createFile('libs/other/src/index.ts')],
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
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
            otherName: {
              name: 'otherName',
              type: 'lib',
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          mylibName: [createFile(`libs/mylib/src/main.ts`)],
          otherName: [createFile('libs/other/src/index.ts')],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        mylibName: [
          createFile(`libs/mylib/src/main.ts`),
          createFile(`libs/mylib/src/other.ts`),
        ],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          utils: {
            name: 'utils',
            type: 'lib',
            data: {
              root: 'libs/utils',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`)],
        utils: [createFile(`libs/utils/a.ts`)],
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
              type: 'lib',
              data: {
                root: 'libs/mylib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
            otherName: {
              name: 'otherName',
              type: 'lib',
              data: {
                root: 'libs/other',
                tags: [],
                implicitDependencies: [],
                targets: {},
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
              {
                source: 'mylibName',
                target: 'otherName',
                type: DependencyType.static,
              },
            ],
          },
        },
        {
          mylibName: [
            createFile(`libs/mylib/src/main.ts`, [
              ['otherName', 'static'],
              ['otherName', 'dynamic'],
            ]),
          ],
          otherName: [createFile(`libs/other/index.ts`)],
        }
      );
      if (importKind === 'type') {
        expect(failures.length).toEqual(0);
      } else {
        expect(failures[0].message).toMatchInlineSnapshot(`
          "Static imports of lazy-loaded libraries are forbidden.

          Library "otherName" is lazy-loaded in these files:
          - libs/mylib/src/main.ts"
        `);
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappName: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`)],
        myappName: [createFile(`apps/myapp/src/index.ts`)],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappE2eName: {
            name: 'myappE2eName',
            type: 'e2e',
            data: {
              root: 'apps/myapp-e2e',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
        },
        dependencies: {},
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`)],
        myappE2eName: [createFile(`apps/myapp-e2e/src/index.ts`)],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappName: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
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
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`)],
        anotherlibName: [createFile(`libs/anotherlib/src/main.ts`)],
        myappName: [createFile(`apps/myapp/src/index.ts`)],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappName: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
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
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`)],
        anotherlibName: [createFile(`libs/anotherlib/src/main.ts`)],
        myappName: [createFile(`apps/myapp/src/index.ts`)],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappName: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
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
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`, ['anotherlibName'])],
        anotherlibName: [
          createFile(`libs/anotherlib/src/main.ts`, ['mylibName']),
        ],
        myappName: [createFile(`apps/myapp/src/index.ts`)],
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
            type: 'lib',
            data: {
              root: 'libs/mylib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          anotherlibName: {
            name: 'anotherlibName',
            type: 'lib',
            data: {
              root: 'libs/anotherlib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          badcirclelibName: {
            name: 'badcirclelibName',
            type: 'lib',
            data: {
              root: 'libs/badcirclelib',
              tags: [],
              implicitDependencies: [],
              targets: {},
            },
          },
          myappName: {
            name: 'myappName',
            type: 'app',
            data: {
              root: 'apps/myapp',
              tags: [],
              implicitDependencies: [],
              targets: {},
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
      },
      {
        mylibName: [createFile(`libs/mylib/src/main.ts`, ['mylibName'])],
        anotherlibName: [
          createFile(`libs/anotherlib/src/main.ts`, ['mylibName']),
          createFile(`libs/anotherlib/src/index.ts`, ['mylibName']),
        ],
        badcirclelibName: [
          createFile(`libs/badcirclelib/src/main.ts`, ['anotherlibName']),
        ],
        myappName: [createFile(`apps/myapp/index.ts`)],
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
              type: 'lib',
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
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
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
              type: 'lib',
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
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
        }
      );

      const message =
        'Buildable libraries cannot import or export from non-buildable libraries';
      expect(failures.length).toEqual(2);
      expect(failures[0].message).toEqual(message);
      expect(failures[1].message).toEqual(message);
    });

    it('should error when buildable libraries with custom target import non-buildable libraries', () => {
      const failures = runRule(
        {
          enforceBuildableLibDependency: true,
          buildTargets: ['my-build'],
        },
        `${process.cwd()}/proj/libs/buildableLib2/src/main.ts`,
        `
          import '@nonBuildableScope/nonBuildableLib';
          import('@nonBuildableScope/nonBuildableLib');
        `,
        {
          nodes: {
            buildableLib2: {
              name: 'buildableLib2',
              type: 'lib',
              data: {
                root: 'libs/buildableLib2',
                tags: [],
                implicitDependencies: [],
                targets: {
                  'my-build': {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib2: [createFile(`libs/buildableLib2/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
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
          buildTargets: ['my-build', 'build'],
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
              type: 'lib',
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
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  'my-build': {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          anotherBuildableLib: [
            createFile(`libs/anotherBuildableLib/src/main.ts`),
          ],
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
              type: 'lib',
              data: {
                root: 'libs/buildableLib',
                tags: [],
                implicitDependencies: [],
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
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
              type: 'lib',
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
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
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
              type: 'lib',
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
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          anotherBuildableLib: [
            createFile(`libs/anotherBuildableLib/src/main.ts`),
          ],
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
              type: 'lib',
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
              },
            },
            nonBuildableLib: {
              name: 'nonBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/nonBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {},
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          nonBuildableLib: [createFile(`libs/nonBuildableLib/src/main.ts`)],
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
              type: 'lib',
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
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          anotherBuildableLib: [
            createFile(`libs/anotherBuildableLib/src/main.ts`),
          ],
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
              type: 'lib',
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
              },
            },
            anotherBuildableLib: {
              name: 'anotherBuildableLib',
              type: 'lib',
              data: {
                root: 'libs/anotherBuildableLib',
                tags: [],
                implicitDependencies: [],
                targets: {
                  build: {
                    // defines a buildable lib
                    executor: '@angular-devkit/build-ng-packagr:build',
                  },
                },
              },
            },
          },
          dependencies: {},
        },
        {
          buildableLib: [createFile(`libs/buildableLib/src/main.ts`)],
          anotherBuildableLib: [
            createFile(`libs/anotherBuildableLib/src/main.ts`),
          ],
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

function createFile(f: string, deps?: (string | [string, string])[]): FileData {
  return { file: f, hash: '', deps };
}

function runRule(
  ruleArguments: any,
  contentPath: string,
  content: string,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap
): TSESLint.Linter.LintMessage[] {
  (global as any).projectPath = `${process.cwd()}/proj`;
  (global as any).projectGraph = projectGraph;
  (global as any).projectFileMap = projectFileMap;
  (global as any).projectRootMappings = createProjectRootMappings(
    projectGraph.nodes
  );
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
