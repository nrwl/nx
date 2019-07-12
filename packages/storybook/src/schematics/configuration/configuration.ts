import {
  apply,
  chain,
  externalSchematic,
  mergeWith,
  move,
  Rule,
  schematic,
  SchematicContext,
  Tree,
  url,
  template
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  updateWorkspace,
  addPackageWithNgAdd,
  offsetFromRoot,
  readJsonFile
} from '@nrwl/workspace';
import { StorybookStoriesSchema } from '../../../../angular/src/schematics/stories/stories';
import { parseJsonAtPath } from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    schematic('ng-add', {}),
    createRootStorybookDir(),
    createLibStorybookDir(schema.name),
    configureTsConfig(schema.name),
    addStorybookTask(schema.name),
    schema.configureCypress
      ? schematic<CypressConfigureSchema>('cypress-project', {
          name: schema.name
        })
      : () => {},
    schema.generateStories
      ? externalSchematic<StorybookStoriesSchema>('@nrwl/angular', 'stories', {
          name: schema.name,
          generateCypressSpecs:
            schema.configureCypress && schema.generateCypressSpecs
        })
      : () => {}
  ]);
}

function createRootStorybookDir(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    return chain([mergeWith(apply(url('./root-files'), []))])(tree, context);
  };
}

function createLibStorybookDir(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');
    const projectConfig = getProjectConfig(tree, projectName);

    return chain([
      mergeWith(
        apply(url('./lib-files'), [
          template({
            tmpl: '',
            offsetFromRoot: offsetFromRoot(projectConfig.root)
          }),
          move(projectConfig.root)
        ])
      )
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

    tsConfigContent.exclude = [...tsConfigContent.exclude, '**/*.stories.ts'];

    tree.overwrite(
      tsConfigPath,
      JSON.stringify(tsConfigContent, null, 2) + '\n'
    );
    return tree;
  };
}

function addStorybookTask(projectName: string): Rule {
  return updateWorkspace(workspace => {
    const projectConfig = workspace.projects.get(projectName);
    let uiFramework = '@storybook/react';
    try {
      if (
        readJsonFile(projectConfig.root + '/tsconfig.lib.json')
          .angularCompilerOptions
      ) {
        uiFramework = '@storybook/angular';
      }
    } catch (e) {}
    projectConfig.targets.add({
      name: 'storybook',
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
  });
}
