import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  schematic,
  SchematicContext,
  Tree,
  url
} from '@angular-devkit/schematics';
import { getWorkspace } from '@schematics/angular/utility/config';
import {} from '@schematics/angular/utility/json-utils';
import { getProject } from '@schematics/angular/utility/project';
import { updateWorkspace } from '@schematics/angular/utility/workspace';
import { parseJsonAtPath } from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-configure/cypress-configure';
import { StorybookStoriesSchema } from '../storybook-stories/storybook-stories';
import { StorybookConfigureSchema } from './schema';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    createStorybookDir(schema.name),
    configureTsConfig(schema.name),
    addStorybookTask(schema.name),
    schema.configureCypress
      ? schematic<CypressConfigureSchema>('cypress-configure', {
          name: schema.name
        })
      : () => {},
    schema.generateStories
      ? schematic<StorybookStoriesSchema>('storybook-stories', {
          name: schema.name,
          generateCypressSpecs:
            schema.configureCypress && schema.generateCypressSpecs
        })
      : () => {}
  ]);
}

function createStorybookDir(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    return chain([
      mergeWith(
        apply(url('./files'), [move(getProject(tree, projectName).root)])
      )
    ])(tree, context);
  };
}

function configureTsConfig(projectName: string): Rule {
  return (tree: Tree) => {
    const projectPath = getWorkspace(tree).projects[projectName].root;
    const tsConfigPath = projectPath + '/tsconfig.lib.json';
    const projectTsConfig = parseJsonAtPath(tree, tsConfigPath);

    let tsConfigContent: any;

    if (projectTsConfig && projectTsConfig.value) {
      tsConfigContent = projectTsConfig.value;
    } else {
      return tree;
    }

    tsConfigContent.exclude = [...tsConfigContent.exclude, '**/*.stories.ts'];

    return tree.overwrite(
      tsConfigPath,
      JSON.stringify(tsConfigContent, null, 2) + '\n'
    );
  };
}

function addStorybookTask(projectName: string): Rule {
  return <any>updateWorkspace(workspace => {
    workspace.projects.get(projectName).targets.add({
      name: 'storybook',
      builder: '@nrwl/workspace:run-commands',
      options: {
        readyWhen: 'http://localhost:4400',
        commands: [
          {
            command: `npx start-storybook -c ${
              workspace.projects.get(projectName).root
            }/.storybook -p 4400`
          }
        ]
      },
      configurations: {
        ci: {
          commands: [
            {
              command: `npx start-storybook -c ${
                workspace.projects.get(projectName).root
              }/.storybook -p 4400 --ci --quiet`
            }
          ]
        }
      }
    });
  });
}
