import {
  addProjectConfiguration as _addProjectConfiguration,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  mockCjsModule as mockConverterModule,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
    return projectGraph;
  }),
  updateProjectConfiguration: vi
    .fn()
    .mockImplementation((tree, projectName, projectConfiguration) => {
      function handleEmptyTargets(
        projectName: string,
        projectConfiguration: ProjectConfiguration
      ): void {
        if (
          projectConfiguration.targets &&
          !Object.keys(projectConfiguration.targets).length
        ) {
          // Re-order `targets` to appear after the `// target` comment.
          delete projectConfiguration.targets;
          projectConfiguration['// targets'] =
            `to see all targets run: nx show project ${projectName} --web`;
          projectConfiguration.targets = {};
        } else {
          delete projectConfiguration['// targets'];
        }
      }

      const projectConfigFile = joinPathFragments(
        projectConfiguration.root,
        'project.json'
      );

      if (!tree.exists(projectConfigFile)) {
        throw new Error(
          `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
        );
      }
      handleEmptyTargets(projectName, projectConfiguration);
      writeJson(tree, projectConfigFile, {
        name: projectConfiguration.name ?? projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
      });
      projectGraph.nodes[projectName].data = projectConfiguration;
    }),
}));

function addProjectConfiguration(
  tree: Tree,
  name: string,
  project: ProjectConfiguration
) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: project.projectType === 'application' ? 'app' : 'lib',
    data: {
      projectType: project.projectType,
      root: project.root,
      targets: project.targets,
    },
  };
}

interface CreateEslintLintProjectOptions {
  appName: string;
  appRoot: string;
  targetName: string;
  legacyExecutor?: boolean;
  eslintConfigDir?: string;
}

const defaultCreateEslintLintProjectOptions: CreateEslintLintProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  targetName: 'lint',
  legacyExecutor: false,
};

function createTestProject(
  tree: Tree,
  opts: Partial<CreateEslintLintProjectOptions> = defaultCreateEslintLintProjectOptions
) {
  let projectOpts = { ...defaultCreateEslintLintProjectOptions, ...opts };
  projectOpts.eslintConfigDir ??= projectOpts.appRoot;
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.targetName]: {
        executor: projectOpts.legacyExecutor
          ? '@nrwl/linter:eslint'
          : '@nx/eslint:lint',
        options: {
          eslintConfig: `${projectOpts.appRoot}/.eslintrc.json`,
        },
      },
    },
  };

  const eslintConfigContents = {
    rules: {},
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {},
      },
      {
        files: ['./project.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/nx-plugin-checks': 'error',
        },
      },
      {
        files: ['./package.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              buildTargets: ['build-base'],
              ignoredDependencies: [
                'nx',
                '@nx/jest',
                'typescript',
                'eslint',
                '@angular-devkit/core',
                '@typescript-eslint/eslint-plugin',
              ],
            },
          ],
        },
      },
    ],
    ignorePatterns: ['!**/*'],
  };
  const eslintConfigContentsAsString = JSON.stringify(eslintConfigContents);

  tree.write(
    `${projectOpts.appRoot}/.eslintrc.json`,
    eslintConfigContentsAsString
  );
  fs.createFileSync(
    `${projectOpts.appRoot}/.eslintrc.json`,
    eslintConfigContentsAsString
  );

  tree.write(`${projectOpts.appRoot}/src/foo.ts`, `export const myValue = 2;`);
  fs.createFileSync(
    `${projectOpts.appRoot}/src/foo.ts`,
    `export const myValue = 2;`
  );
  vi.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/.eslintrc.json`),
    () => ({
      default: {
        extends: '../../.eslintrc',
        rules: {},
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {},
          },
          {
            files: ['**/*.ts'],
            excludedFiles: ['./src/migrations/**'],
            rules: {
              'no-restricted-imports': ['error', '@nx/workspace'],
            },
          },
          {
            files: [
              './package.json',
              './generators.json',
              './executors.json',
              './migrations.json',
            ],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/nx-plugin-checks': 'error',
            },
          },
          {
            files: ['./package.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': [
                'error',
                {
                  buildTargets: ['build-base'],
                  ignoredDependencies: [
                    'nx',
                    '@nx/jest',
                    'typescript',
                    'eslint',
                    '@angular-devkit/core',
                    '@typescript-eslint/eslint-plugin',
                  ],
                },
              ],
            },
          },
        ],
        ignorePatterns: ['!**/*'],
      },
    }),
    {
      virtual: true,
    }
  );

  addProjectConfiguration(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

import * as converter from '../../generators/convert-to-inferred/convert-to-inferred';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockConverterModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('eslint');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };

    tree.write(
      'package.json',
      JSON.stringify({ name: 'workspace', version: '0.0.1' })
    );
    fs.createFileSync(
      'package.json',
      JSON.stringify({ name: 'workspace', version: '0.0.1' })
    );
  });

  afterEach(() => {
    fs.reset();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/eslint/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "targetName": "lint",
        },
        "plugin": "@nx/eslint/plugin",
      }
    `);
    expect(
      readProjectConfiguration(tree, project.name).targets
    ).toMatchInlineSnapshot(`{}`);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
