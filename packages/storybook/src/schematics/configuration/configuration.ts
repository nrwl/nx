import {
  chain,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  updateWorkspace,
  updateWorkspaceInTree,
  serializeJson,
  Linter,
  updateJsonInTree,
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import {
  applyWithSkipExisting,
  isFramework,
  getTsConfigContent,
  TsConfig,
} from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import { readPackageJson } from '@nrwl/workspace/src/core/file-utils';
import { storybookVersion } from '../../utils/versions';
import { projectDir } from '@nrwl/workspace/src/utils/project-type';
import { offsetFromRoot } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export default function (rawSchema: StorybookConfigureSchema): Rule {
  const schema = normalizeSchema(rawSchema);

  const workspaceStorybookVersion = readCurrentWorkspaceStorybookVersion();

  return (tree: Tree, context: SchematicContext) => {
    const { projectType } = getProjectConfig(tree, schema.name);
    return chain([
      schematic('ng-add', {
        uiFramework: schema.uiFramework,
      }),
      createRootStorybookDir(schema.name, schema.js, workspaceStorybookVersion),
      createProjectStorybookDir(
        schema.name,
        schema.uiFramework,
        schema.js,
        workspaceStorybookVersion
      ),
      configureTsProjectConfig(schema),
      configureTsSolutionConfig(schema),
      updateLintConfig(schema),
      addStorybookTask(schema.name, schema.uiFramework),
      schema.configureCypress && projectType !== 'application'
        ? schematic<CypressConfigureSchema>('cypress-project', {
            name: schema.name,
            js: schema.js,
            linter: schema.linter,
          })
        : () => {
            context.logger.warn('There is already an e2e project setup');
          },
    ]);
  };
}

function normalizeSchema(schema: StorybookConfigureSchema) {
  const defaults = {
    linter: Linter.TsLint,
    js: false,
  };
  return {
    ...defaults,
    ...schema,
  };
}

function createRootStorybookDir(
  projectName: string,
  js: boolean,
  workspaceStorybookVersion: string
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const { projectType } = getProjectConfig(tree, projectName);
    const projectDirectory = projectDir(projectType);
    context.logger.debug(
      `adding .storybook folder to ${projectDirectory} -\n
  based on the Storybook version installed: ${workspaceStorybookVersion}, we'll bootstrap a scaffold for that particular version.`
    );
    return chain([
      applyWithSkipExisting(
        url(
          workspaceStorybookVersion === '6' ? './root-files' : './root-files-5'
        ),
        [js ? toJS() : noop()]
      ),
    ])(tree, context);
  };
}

function createProjectStorybookDir(
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean,
  workspaceStorybookVersion: string
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    /**
     * Here, same as above
     * Check storybook version
     * and use the correct folder
     * lib-files-5 or lib-files-6
     */

    const projectConfig = getProjectConfig(tree, projectName);
    const { projectType } = getProjectConfig(tree, projectName);
    const projectDirectory = projectDir(projectType);
    context.logger.debug(
      `adding .storybook folder to ${projectDirectory} - using Storybook version ${workspaceStorybookVersion}`
    );

    return chain([
      applyWithSkipExisting(
        url(
          workspaceStorybookVersion === '6'
            ? './project-files'
            : './project-files-5'
        ),
        [
          template({
            tmpl: '',
            uiFramework,
            offsetFromRoot: offsetFromRoot(projectConfig.root),
            projectType: projectDirectory,
          }),
          move(projectConfig.root),
          js ? toJS() : noop(),
        ]
      ),
    ])(tree, context);
  };
}

function getTsConfigPath(
  tree: Tree,
  projectName: string,
  path?: string
): string {
  const { projectType } = getProjectConfig(tree, projectName);
  const projectPath = getProjectConfig(tree, projectName).root;
  return join(
    projectPath,
    path && path.length > 0
      ? path
      : projectType === 'application'
      ? 'tsconfig.app.json'
      : 'tsconfig.lib.json'
  );
}

function configureTsProjectConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return (tree: Tree) => {
    let tsConfigPath: string;
    let tsConfigContent: TsConfig;

    try {
      tsConfigPath = getTsConfigPath(tree, projectName);
      tsConfigContent = getTsConfigContent(tree, tsConfigPath);
    } catch {
      /**
       * Custom app configurations
       * may contain a tsconfig.json
       * instead of a tsconfig.app.json.
       */

      tsConfigPath = getTsConfigPath(tree, projectName, 'tsconfig.json');
      tsConfigContent = getTsConfigContent(tree, tsConfigPath);
    }

    tsConfigContent.exclude = [
      ...(tsConfigContent.exclude || []),
      '**/*.stories.ts',
      '**/*.stories.js',
      ...(isFramework('react', schema)
        ? ['**/*.stories.jsx', '**/*.stories.tsx']
        : []),
    ];

    tree.overwrite(tsConfigPath, serializeJson(tsConfigContent));

    return tree;
  };
}

function configureTsSolutionConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return (tree: Tree) => {
    const projectPath = getProjectConfig(tree, projectName).root;
    const tsConfigPath = projectPath + '/tsconfig.json';
    const tsConfigContent = getTsConfigContent(tree, tsConfigPath);

    tsConfigContent.references = [
      ...(tsConfigContent.references || []),
      {
        path: './.storybook/tsconfig.json',
      },
    ];

    tree.overwrite(tsConfigPath, serializeJson(tsConfigContent));

    return tree;
  };
}

/**
 * When adding storybook we need to inform TSLint or ESLint
 * of the additional tsconfig.json file which will be the only tsconfig
 * which includes *.stories files.
 *
 * For TSLint this is done via the builder config, for ESLint this is
 * done within the .eslintrc.json file.
 */
function updateLintConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return chain([
    updateWorkspaceInTree((json) => {
      const projectConfig = json.projects[projectName];
      const isUsingTSLint =
        projectConfig.architect?.lint?.builder ===
        '@angular-devkit/build-angular:tslint';

      if (isUsingTSLint) {
        projectConfig.architect.lint.options.tsConfig = [
          ...projectConfig.architect.lint.options.tsConfig,
          `${projectConfig.root}/.storybook/tsconfig.json`,
        ];
      }

      return json;
    }),
    (tree: Tree) => {
      const projectConfig = getProjectConfig(tree, projectName);
      const isUsingESLint =
        (projectConfig.architect?.lint?.builder === '@nrwl/linter:lint' &&
          projectConfig.architect?.lint?.options?.linter === 'eslint') ||
        projectConfig.architect?.lint?.builder === '@nrwl/linter:eslint';

      if (!isUsingESLint) {
        return;
      }

      return updateJsonInTree(
        `${projectConfig.root}/.eslintrc.json`,
        (json) => {
          if (typeof json.parserOptions?.project === 'string') {
            json.parserOptions.project = [json.parserOptions.project];
          }

          if (Array.isArray(json.parserOptions?.project)) {
            json.parserOptions.project.push(
              `${projectConfig.root}/.storybook/tsconfig.json`
            );
          }

          const overrides = json.overrides || [];
          for (const override of overrides) {
            if (typeof override.parserOptions?.project === 'string') {
              override.parserOptions.project = [override.parserOptions.project];
            }
            if (Array.isArray(override.parserOptions?.project)) {
              override.parserOptions.project.push(
                `${projectConfig.root}/.storybook/tsconfig.json`
              );
            }
          }

          return json;
        }
      );
    },
  ]);
}

function addStorybookTask(projectName: string, uiFramework: string): Rule {
  return updateWorkspace((workspace) => {
    const projectConfig = workspace.projects.get(projectName);
    if (!projectConfig) {
      return;
    }

    projectConfig.targets.set('storybook', {
      builder: '@nrwl/storybook:storybook',
      options: {
        uiFramework,
        port: 4400,
        config: {
          configFolder: `${projectConfig.root}/.storybook`,
        },
      },
      configurations: {
        ci: {
          quiet: true,
        },
      },
    });
    projectConfig.targets.set('build-storybook', {
      builder: '@nrwl/storybook:build',
      outputs: ['{options.outputPath}'],
      options: {
        uiFramework,
        outputPath: join(
          normalize('dist'),
          normalize('storybook'),
          projectName
        ),
        config: {
          configFolder: `${projectConfig.root}/.storybook`,
        },
      },
      configurations: {
        ci: {
          quiet: true,
        },
      },
    } as any);
  });
}

function readCurrentWorkspaceStorybookVersion(): string {
  const packageJsonContents = readPackageJson();
  let workspaceStorybookVersion = storybookVersion;
  if (packageJsonContents && packageJsonContents['devDependencies']) {
    if (packageJsonContents['devDependencies']['@storybook/angular']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/angular'];
    }
    if (packageJsonContents['devDependencies']['@storybook/react']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/react'];
    }
    if (packageJsonContents['devDependencies']['@storybook/core']) {
      workspaceStorybookVersion =
        packageJsonContents['devDependencies']['@storybook/core'];
    }
  }
  if (packageJsonContents && packageJsonContents['dependencies']) {
    if (packageJsonContents['dependencies']['@storybook/angular']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/angular'];
    }
    if (packageJsonContents['dependencies']['@storybook/react']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/react'];
    }
    if (packageJsonContents['dependencies']['@storybook/core']) {
      workspaceStorybookVersion =
        packageJsonContents['dependencies']['@storybook/core'];
    }
  }
  if (
    workspaceStorybookVersion.startsWith('6') ||
    workspaceStorybookVersion.startsWith('^6')
  ) {
    workspaceStorybookVersion = '6';
  }
  return workspaceStorybookVersion;
}

export const configurationGenerator = wrapAngularDevkitSchematic(
  '@nrwl/storybook',
  'configuration'
);
