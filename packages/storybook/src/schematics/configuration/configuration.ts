import {
  chain,
  externalSchematic,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  offsetFromRoot,
  readJsonFile,
  updateWorkspace
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import { StorybookStoriesSchema } from '../../../../angular/src/schematics/stories/stories';
import { applyWithSkipExisting, parseJsonAtPath } from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    schematic('ng-add', {}),
    createRootStorybookDir(schema.name, schema.js),
    createLibStorybookDir(schema.name, schema.uiFramework, schema.js),
    configureTsConfig(schema.name),
    addStorybookTask(schema.name, schema.uiFramework),
    schema.configureCypress
      ? schematic<CypressConfigureSchema>('cypress-project', {
          name: schema.name,
          js: schema.js,
          linter: schema.linter
        })
      : () => {}
  ]);
}

function createRootStorybookDir(projectName: string, js: boolean): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    return chain([
      applyWithSkipExisting(url('./root-files'), [js ? toJS() : noop()])
    ])(tree, context);
  };
}

function createLibStorybookDir(
  projectName: string,
  uiFramework: string,
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
          offsetFromRoot: offsetFromRoot(projectConfig.root)
        }),
        move(projectConfig.root),
        js ? toJS() : noop()
      ])
    ])(tree, context);
  };
}

function configureTsConfig(projectName: string): Rule {
  return (tree: Tree) => {
    const projectPath = getProjectConfig(tree, projectName).root;
    const tsConfigPath = projectPath + '/tsconfig.lib.json';
    const projectTsConfig = parseJsonAtPath(tree, tsConfigPath);

    let tsConfigContent: any;

    if (projectTsConfig && projectTsConfig.value) {
      tsConfigContent = projectTsConfig.value;
    } else {
      return tree;
    }

    tsConfigContent.exclude = [
      ...tsConfigContent.exclude,
      '**/*.stories.ts',
      '**/*.stories.js'
    ];

    tree.overwrite(
      tsConfigPath,
      JSON.stringify(tsConfigContent, null, 2) + '\n'
    );
    return tree;
  };
}

function addStorybookTask(projectName: string, uiFramework: string): Rule {
  return updateWorkspace(workspace => {
    const projectConfig = workspace.projects.get(projectName);
    projectConfig.targets.set('storybook', {
      builder: '@nrwl/storybook:storybook',
      options: {
        uiFramework,
        port: 4400,
        config: {
          configFolder: `${projectConfig.root}/.storybook`
        }
      },
      configurations: {
        ci: {
          quiet: true
        }
      }
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
          configFolder: `${projectConfig.root}/.storybook`
        }
      },
      configurations: {
        ci: {
          quiet: true
        }
      }
    });
  });
}
