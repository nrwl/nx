import { TempFs } from '../../../../internal-testing-utils/temp-fs';

const tempFs = new TempFs('explicit-project-deps');

import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { ProjectConfiguration } from '../../../../config/workspace-json-project-json';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { loadNxPlugins } from '../../../../project-graph/plugins/internal-api';
import { ProjectGraphBuilder } from '../../../../project-graph/project-graph-builder';
import {
  retrieveProjectConfigurations,
  retrieveWorkspaceFiles,
} from '../../../../project-graph/utils/retrieve-workspace-files';
import { setupWorkspaceContext } from '../../../../utils/workspace-context';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { TargetProjectLocator } from './target-project-locator';

// projectName => tsconfig import path
const dependencyProjectNamesToImportPaths = {
  proj2: '@proj/my-second-proj',
  proj3a: '@proj/project-3',
  proj4ab: '@proj/proj4ab',
};

describe('explicit project dependencies', () => {
  afterEach(() => {
    tempFs.reset();
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  describe('static imports, dynamic imports, and commonjs requires', () => {
    it('should build explicit dependencies for static imports, and top-level dynamic imports and commonjs requires', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj2',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj4ab',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'npm:npm-package',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj3a',
          type: 'dynamic',
        },
      ]);
    });

    it('should preferentially resolve external projects found in the npmResolutionCache', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
        sourceProjectFiles: [
          {
            path: 'libs/proj/index.ts',
            content: `
              import * as npmPackage from 'npm-package';
            `,
          },
        ],
      });

      const npmResolutionCache = new Map();
      // Add an example of a alternate version of npm-package in the workspace within the cache
      npmResolutionCache.set('npm-package__libs/proj', 'npm:npm-package@0.5.0');

      const targetProjectLocatorWithEmptyCache = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );
      const targetProjectLocatorWithCache = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        npmResolutionCache
      );

      const resWithEmptyCache = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocatorWithEmptyCache
      );
      const resWithCache = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocatorWithCache
      );

      expect(resWithEmptyCache).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'npm:npm-package',
          type: 'static',
        },
      ]);

      expect(resWithCache).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          // Preferred the version in the cache instead of going through the full resolution process to find the 1.0.0 version in tempFs node_modules
          target: 'npm:npm-package@0.5.0',
          type: 'static',
        },
      ]);
    });

    it('should build explicit dependencies for static exports', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj2',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj3a',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj4ab',
          type: 'static',
        },
      ]);
    });

    it('should build explicit dependencies for static exports in .mts files', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
        sourceProjectFiles: [
          {
            path: 'libs/proj/index.mts',
            content: `
              export {a} from '@proj/my-second-proj';
              export * as project3 from '@proj/project-3';
              export * from '@proj/proj4ab';
            `,
          },
        ],
      });
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );
      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.mts',
          target: 'proj2',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.mts',
          target: 'proj3a',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.mts',
          target: 'proj4ab',
          type: 'static',
        },
      ]);
    });

    it(`should build explicit dependencies for TypeScript's import/export require syntax, and side-effectful import`, async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj2',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj3a',
          type: 'static',
        },
        {
          source,
          sourceFile: 'libs/proj/index.ts',
          target: 'proj4ab',
          type: 'static',
        },
      ]);
    });

    it('should build explicit dependencies for nested dynamic imports and commonjs requires', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/component.tsx',
          target: 'proj2',
          type: 'dynamic',
        },
        {
          source,
          sourceFile: 'libs/proj/nested-dynamic-import.ts',
          target: 'proj3a',
          type: 'dynamic',
        },
        {
          source,
          sourceFile: 'libs/proj/nested-require.ts',
          target: 'proj4ab',
          type: 'static',
        },
      ]);
    });

    it('should build explicit dependencies when relative paths are used', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([
        {
          source,
          sourceFile: 'libs/proj/absolute-path.ts',
          target: 'proj3a',
          type: 'dynamic',
        },
        {
          source,
          sourceFile: 'libs/proj/relative-path.ts',
          target: 'proj4ab',
          type: 'dynamic',
        },
      ]);
    });

    it('should not build explicit dependencies when nx-ignore-next-line comments are present', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
              
              /*

              nx-ignore-next-line */
              import { foo } from '@proj/proj4ab'; import { foo } from '@proj/project-3';
              
              /* eslint-ignore */ /* nx-ignore-next-line */
              import { foo } from '@proj/proj4ab'; import { foo } from '@proj/project-3';
              
              const obj = {
                // nx-ignore-next-line
                a: import('@proj/proj4ab')
              }
            `,
          },
        ],
      });
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([]);
    });

    it('should not build explicit dependencies for stringified or templatized import/require statements', async () => {
      const source = 'proj';
      const ctx = await createContext({
        source,
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
      const targetProjectLocator = new TargetProjectLocator(
        convertProjectsForTargetProjectLocator(ctx.projects),
        ctx.externalNodes,
        new Map()
      );

      const res = buildExplicitTypeScriptDependencies(
        ctx,
        targetProjectLocator
      );

      expect(res).toEqual([]);
    });
  });
});

interface VirtualWorkspaceConfig {
  source: string;
  sourceProjectFiles: {
    path: string;
    content: string;
  }[];
}

/**
 * Prepares a minimal workspace and virtual file-system for the given files and dependency
 * projects in order to be able to execute `buildExplicitTypeScriptDependencies()` in the tests.
 */
async function createContext(
  config: VirtualWorkspaceConfig
): Promise<CreateDependenciesContext> {
  const nxJson = {};
  const projectsFs = {
    [`./libs/${config.source}/project.json`]: JSON.stringify({
      name: config.source,
      sourceRoot: `libs/${config.source}`,
    }),
  };

  const fsJson = {
    './package.json': `{
      "name": "test",
      "dependencies": {
        "npm-package": "1.0.0"
      },
      "devDependencies": []
    }`,
    './nx.json': JSON.stringify(nxJson),
    ...config.sourceProjectFiles.reduce(
      (acc, file) => ({
        ...acc,
        [file.path]: file.content,
      }),
      {}
    ),
    './node_modules/npm-package/package.json': JSON.stringify({
      name: 'npm-package',
      version: '1.0.0',
    }),
  };
  const tsConfig = {
    compilerOptions: {
      baseUrl: '.',
      paths: {
        [`@proj/${config.source}`]: [`libs/${config.source}/index.ts`],
      },
    },
  };

  const builder = new ProjectGraphBuilder();
  builder.addNode({
    name: config.source,
    type: 'lib',
    data: {
      root: `libs/${config.source}`,
      files: config.sourceProjectFiles.map(({ path }) => ({
        file: path,
      })),
    } as any,
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

    projectsFs[`./libs/${projectName}/project.json`] = JSON.stringify({
      name: projectName,
      sourceRoot: `libs/${projectName}`,
    });
    tsConfig.compilerOptions.paths[tsconfigPath] = [
      `libs/${projectName}/index.ts`,
    ];
    builder.addNode({
      name: projectName,
      type: 'lib',
      data: {
        root: `libs/${projectName}`,
      },
    });
  }

  fsJson['./tsconfig.base.json'] = JSON.stringify(tsConfig);

  await tempFs.createFiles({
    ...fsJson,
    ...projectsFs,
  });

  setupWorkspaceContext(tempFs.tempDir);

  const [plugins, cleanup] = await loadNxPlugins([], tempFs.tempDir);
  const { projects, projectRootMap } = await retrieveProjectConfigurations(
    plugins,
    tempFs.tempDir,
    nxJson
  );
  cleanup();

  const { fileMap } = await retrieveWorkspaceFiles(
    tempFs.tempDir,
    projectRootMap
  );

  return {
    externalNodes: builder.getUpdatedProjectGraph().externalNodes,
    projects: Object.fromEntries(
      Object.entries(projects).map(([root, config]) => [config.name, config])
    ),
    nxJsonConfiguration: nxJson,
    filesToProcess: fileMap,
    fileMap: fileMap,
    workspaceRoot: tempFs.tempDir,
  };
}

function convertProjectsForTargetProjectLocator(
  projects: Record<string, ProjectConfiguration>
): Record<string, ProjectGraphProjectNode> {
  return Object.fromEntries(
    Object.entries(projects).map(([key, config]) => [
      key,
      {
        name: key,
        type: null,
        data: config,
      },
    ])
  );
}
