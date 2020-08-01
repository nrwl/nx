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
  offsetFromRoot,
  updateWorkspace,
  updateWorkspaceInTree,
  serializeJson,
  Linter,
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';

import {
  applyWithSkipExisting,
  isFramework,
  getTsConfigContent,
} from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';

export default function (rawSchema: StorybookConfigureSchema): Rule {
  const schema = normalizeSchema(rawSchema);
  return chain([
    schematic('ng-add', {
      uiFramework: schema.uiFramework,
    }),
    createRootStorybookDir(schema.name, schema.js),
    createLibStorybookDir(schema.name, schema.uiFramework, schema.js),
    configureTsLibConfig(schema),
    configureTsSolutionConfig(schema),
    updateLintTask(schema),
    addStorybookTask(schema.name, schema.uiFramework),
    schema.configureCypress
      ? schematic<CypressConfigureSchema>('cypress-project', {
          name: schema.name,
          js: schema.js,
          linter: schema.linter,
        })
      : () => {},
  ]);
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

function createRootStorybookDir(projectName: string, js: boolean): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    return chain([
      applyWithSkipExisting(url('./root-files'), [js ? toJS() : noop()]),
    ])(tree, context);
  };
}

function createLibStorybookDir(
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');
    const projectConfig = getProjectConfig(tree, projectName);
    return chain([
      applyWithSkipExisting(url('./lib-files'), [
        template({
          tmpl: '',
          uiFramework,
          offsetFromRoot: offsetFromRoot(projectConfig.root),
        }),
        move(projectConfig.root),
        js ? toJS() : noop(),
      ]),
    ])(tree, context);
  };
}

function configureTsLibConfig(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return (tree: Tree) => {
    const projectPath = getProjectConfig(tree, projectName).root;
    const tsConfigPath = join(projectPath, 'tsconfig.lib.json');
    const tsConfigContent = getTsConfigContent(tree, tsConfigPath);

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

function updateLintTask(schema: StorybookConfigureSchema): Rule {
  const { name: projectName } = schema;

  return updateWorkspaceInTree((json) => {
    const projectConfig = json.projects[projectName];
    const lintTarget = projectConfig.architect.lint;

    if (lintTarget) {
      lintTarget.options.tsConfig = [
        ...lintTarget.options.tsConfig,
        `${projectConfig.root}/.storybook/tsconfig.json`,
      ];
    }

    return json;
  });
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
    });
  });
}
