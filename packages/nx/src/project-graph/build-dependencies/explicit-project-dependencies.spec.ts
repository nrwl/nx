import { vol } from 'memfs';
import type { Workspace } from '../../config/workspace-json-project-json';
import { defaultFileHasher } from '../../hasher/file-hasher';
import { createProjectFileMap } from '../file-map-utils';
import { ProjectGraphBuilder } from '../project-graph-builder';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  workspaceRoot: '/root',
}));

// projectName => tsconfig import path
const dependencyProjectNamesToImportPaths = {
  proj2: '@proj/my-second-proj',
  proj3a: '@proj/project-3',
  proj4ab: '@proj/proj4ab',
};

describe('explicit project dependencies', () => {
  beforeEach(() => {
    vol.reset();
  });

  describe('static imports, dynamic imports, and commonjs requires', () => {
    it('should build explicit dependencies for static imports, and top-level dynamic imports and commonjs requires', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/index.ts',
            content: `
              import {a} from '@proj/my-second-proj';
              await import('@proj/project-3');
              require('@proj/proj4ab');
              import * as npmPackage from 'npm-package';
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj2',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj3a',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj4ab',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'npm:npm-package',
        },
      ]);
    });

    it('should build explicit dependencies for static exports', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/index.ts',
            content: `
              export {a} from '@proj/my-second-proj';
              export * as project3 from '@proj/project-3';
              export * from '@proj/proj4ab';
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj2',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj3a',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj4ab',
        },
      ]);
    });

    it(`should build explicit dependencies for TypeScript's import/export require syntax, and side-effectful import`, () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/index.ts',
            content: `
              import i = require("@proj/my-second-proj");
              export import i = require("@proj/project-3");
              import '@proj/proj4ab';
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj2',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj3a',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/index.ts',
          targetProjectName: 'proj4ab',
        },
      ]);
    });

    it('should build explicit dependencies for nested dynamic imports and commonjs requires', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/nested-dynamic-import.ts',
            content: `
              async function nestedInAFunction() {
                await import('@proj/project-3');
              }
            `,
          },
          {
            path: 'libs/proj/nested-require.ts',
            content: `
              function nestedInAFunction() {
                require('@proj/proj4ab');
              }
            `,
          },
          {
            path: 'libs/proj/component.tsx',
            content: `              
              export function App() {
                import('@proj/my-second-proj')
                return (
                  <GlobalStateProvider>
                    <Shell></Shell>
                  </GlobalStateProvider>
                );
              }
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/component.tsx',
          targetProjectName: 'proj2',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/nested-dynamic-import.ts',
          targetProjectName: 'proj3a',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/nested-require.ts',
          targetProjectName: 'proj4ab',
        },
      ]);
    });

    it('should build explicit dependencies when relative paths are used', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/absolute-path.ts',
            content: `
              import('../../libs/proj3a/index.ts');
            `,
          },
          {
            path: 'libs/proj/relative-path.ts',
            content: `
              import('../proj4ab/index.ts');
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/absolute-path.ts',
          targetProjectName: 'proj3a',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/relative-path.ts',
          targetProjectName: 'proj4ab',
        },
      ]);
    });

    it('should not build explicit dependencies when nx-ignore-next-line comments are present', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/static-import-1.ts',
            content: `
              // nx-ignore-next-line
              import {a} from '@proj/my-second-proj';
            `,
          },
          {
            path: 'libs/proj/static-import-2.ts',
            content: `
              /* nx-ignore-next-line */
              import {a} from '@proj/my-second-proj';
            `,
          },
          {
            path: 'libs/proj/dynamic-import-1.ts',
            content: `
              // nx-ignore-next-line
              await import('@proj/project-3');
            `,
          },
          {
            path: 'libs/proj/dynamic-import-2.ts',
            content: `
              /* nx-ignore-next-line */
              await import('@proj/project-3');
            `,
          },
          {
            path: 'libs/proj/dynamic-import-3.ts',
            content: `
              async function nestedInAFunction() {
                /* nx-ignore-next-line */
                await import('@proj/project-3');
              }
            `,
          },
          {
            path: 'libs/proj/require-1.ts',
            content: `
              // nx-ignore-next-line
              require('@proj/proj4ab');
            `,
          },
          {
            path: 'libs/proj/require-2.ts',
            content: `
              /* nx-ignore-next-line */
              require('@proj/proj4ab');
            `,
          },
          {
            path: 'libs/proj/require-3.ts',
            content: `
              function nestedInAFunction() {
                /* nx-ignore-next-line */
                require('@proj/proj4ab');
              }
            `,
          },
          {
            path: 'libs/proj/comments-with-excess-whitespace.ts',
            content: `
              /* 
                nx-ignore-next-line
                
                */
              require('@proj/proj4ab');
              //     nx-ignore-next-line
              import('@proj/proj4ab');
              /* 
                
              nx-ignore-next-line */
              import { foo } from '@proj/proj4ab';
            `,
          },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([]);
    });

    it('should not build explicit dependencies for stringified or templatized import/require statements', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/stringified-imports-and-require.ts',
            content: `
              "import {a} from '@proj/my-second-proj';";
              'await import("@proj/my-second-proj");';
              \`require('@proj/my-second-proj');\`
            `,
          },
          /**
           * TODO: Refactor usage of Scanner to fix these.
           *
           * The use of a template literal before a templatized import/require
           * currently causes Nx to interpret the import/require as if they were not templatized and were declarared directly
           * in the source code.
           */
          // Also reported here: https://github.com/nrwl/nx/issues/8938
          // {
          //   path: 'libs/proj/file-1.ts',
          //   content: `
          //     const npmScope = 'myorg';
          //     console.log(\`@\${npmScope}\`);

          //     console.log(\`import {foo} from '@proj/my-second-proj'\`)
          //   `,
          // },
          // {
          //   path: 'libs/proj/file-2.ts',
          //   content: `
          //     const v = \`\${val}
          //     \${val}
          //         \${val} \${val}

          //           \${val} \${val}

          //           \`;
          //     tree.write('/path/to/file.ts', \`import something from "@proj/project-3";\`);
          //   `,
          // },
          // {
          //   path: 'libs/proj/file-3.ts',
          //   content: `
          //     \`\${Tree}\`;
          //     \`\`;
          //     \`import { A } from '@proj/my-second-proj'\`;
          //     \`import { B, C, D } from '@proj/project-3'\`;
          //     \`require('@proj/proj4ab')\`;
          //   `,
          // },
          // {
          //   path: 'libs/proj/file-4.ts',
          //   // Ensure unterminated template literal does not break project graph creation
          //   content: `
          //     \`\${Tree\`;
          //     \`\`;
          //     \`import { A } from '@proj/my-second-proj'\`;
          //     \`import { B, C, D } from '@proj/project-3'\`;
          //     \`require('@proj/proj4ab')\`;
          //   `,
          // },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([]);
    });
  });

  /**
   * In version 8, Angular deprecated the loadChildren string syntax in favor of using dynamic imports, but it is still
   * fully supported by the framework:
   *
   * https://angular.io/guide/deprecations#loadchildren-string-syntax
   */
  describe('legacy Angular loadChildren string syntax', () => {
    it('should build explicit dependencies for legacy Angular loadChildren string syntax', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/file-1.ts',
            content: `
              const a = { loadChildren: '@proj/proj4ab#a' };
            `,
          },
          {
            path: 'libs/proj/file-2.ts',
            content: `
              const routes: Routes = [{
                path: 'lazy',
                loadChildren: '@proj/project-3#LazyModule',
              }];
            `,
          },
          /**
           * TODO: This case, where a no subsitution template literal is used, is not working
           */
          // {
          //   path: 'libs/proj/no-substitution-template-literal.ts',
          //   content: `
          //     const a = {
          //       loadChildren: \`@proj/my-second-proj\`
          //     };
          //   `,
          // },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/file-1.ts',
          targetProjectName: 'proj4ab',
        },
        {
          sourceProjectName,
          sourceProjectFile: 'libs/proj/file-2.ts',
          targetProjectName: 'proj3a',
        },
      ]);
    });

    it('should not build explicit dependencies when nx-ignore-next-line comments are present', () => {
      const sourceProjectName = 'proj';
      const { ctx, builder } = createVirtualWorkspace({
        sourceProjectName,
        sourceProjectFiles: [
          {
            path: 'libs/proj/file-1.ts',
            content: `
              const a = {
                // nx-ignore-next-line
                loadChildren: '@proj/proj4ab#a'
              };
            `,
          },
          /**
           * TODO: This case, where a multi-line comment is used, is not working
           */
          // {
          //   path: 'libs/proj/file-2.ts',
          //   content: `
          //     const a = {
          //       /* nx-ignore-next-line */
          //       loadChildren: '@proj/proj4ab#a'
          //     };
          //   `,
          // },
          /**
           * TODO: These cases, where loadChildren is on the same line as the variable declaration, are not working
           */
          // {
          //   path: 'libs/proj/file-3.ts',
          //   content: `
          //     // nx-ignore-next-line
          //     const a = { loadChildren: '@proj/proj4ab#a' };
          //   `,
          // },
          // {
          //   path: 'libs/proj/file-4.ts',
          //   content: `
          //     /* nx-ignore-next-line */
          //     const a = { loadChildren: '@proj/proj4ab#a' };
          //   `,
          // },
        ],
      });

      const res = buildExplicitTypeScriptDependencies(
        ctx.workspace,
        builder.graph,
        ctx.filesToProcess
      );

      expect(res).toEqual([]);
    });
  });
});

interface VirtualWorkspaceConfig {
  sourceProjectName: string;
  sourceProjectFiles: {
    path: string;
    content: string;
  }[];
}

/**
 * Prepares a minimal workspace and virtual file-system for the given files and dependency
 * projects in order to be able to execute `buildExplicitTypeScriptDependencies()` in the tests.
 */
function createVirtualWorkspace(config: VirtualWorkspaceConfig) {
  const nxJson = {
    npmScope: 'proj',
  };
  const workspaceJson = {
    projects: {
      [config.sourceProjectName]: {
        root: `libs/${config.sourceProjectName}`,
      },
    },
  };
  const fsJson = {
    './package.json': `{
      "name": "test",
      "dependencies": {
        "npm-package": "1.0.0"
      },
      "devDependencies": []
    }`,
    './workspace.json': JSON.stringify(workspaceJson),
    './nx.json': JSON.stringify(nxJson),
    ...config.sourceProjectFiles.reduce(
      (acc, file) => ({
        ...acc,
        [file.path]: file.content,
      }),
      {}
    ),
  };
  const tsConfig = {
    compilerOptions: {
      baseUrl: '.',
      paths: {
        [`@proj/${config.sourceProjectName}`]: [
          `libs/${config.sourceProjectName}/index.ts`,
        ],
      },
    },
  };

  const builder = new ProjectGraphBuilder();
  builder.addNode({
    name: config.sourceProjectName,
    type: 'lib',
    data: {
      root: `libs/${config.sourceProjectName}`,
      files: config.sourceProjectFiles.map(({ path }) => ({
        file: path,
      })),
    },
  });
  builder.addExternalNode({
    name: 'npm:npm-package',
    type: 'npm',
    data: {
      version: '1.0.0',
      packageName: 'npm-package',
    },
  });

  for (const [projectName, tsconfigPath] of Object.entries(
    dependencyProjectNamesToImportPaths
  )) {
    fsJson[`libs/${projectName}/index.ts`] = ``;
    workspaceJson.projects[projectName] = {
      root: `libs/${projectName}`,
    };
    tsConfig.compilerOptions.paths[tsconfigPath] = [
      `libs/${projectName}/index.ts`,
    ];
    builder.addNode({
      name: projectName,
      type: 'lib',
      data: {
        root: `libs/${projectName}`,
        files: [{ file: `libs/${projectName}/index.ts` }],
      },
    });
  }

  fsJson['./tsconfig.base.json'] = JSON.stringify(tsConfig);

  vol.fromJSON(fsJson, '/root');

  defaultFileHasher.init();

  return {
    ctx: {
      workspace: {
        ...workspaceJson,
        ...nxJson,
      } as Workspace,
      filesToProcess: createProjectFileMap(
        workspaceJson,
        defaultFileHasher.allFileData()
      ).projectFileMap,
    },
    builder,
  };
}
