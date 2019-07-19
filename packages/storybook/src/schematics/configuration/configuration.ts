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
  url
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  getWorkspace,
  updateWorkspace
} from '@nrwl/workspace';
import { StorybookStoriesSchema } from '../../../../angular/src/schematics/stories/stories';
import { parseJsonAtPath } from '../../utils/utils';
import { CypressConfigureSchema } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import workspace from '@nrwl/workspace/src/schematics/workspace/workspace';

export default function(schema: StorybookConfigureSchema): Rule {
  return chain([
    createStorybookDir(schema.name),
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

function createStorybookDir(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    return chain([
      mergeWith(
        apply(url('./files'), [move(getProjectConfig(tree, projectName).root)])
      )
    ])(tree, context);
  };
}

function configureTsConfig(projectName: string): Rule {
  return (tree: Tree) => {
    return from(getWorkspace(tree)).pipe(
      map(workspace => {
        const projectPath = workspace.projects[projectName].root;
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
          '**/*.stories.ts'
        ];

        tree.overwrite(
          tsConfigPath,
          JSON.stringify(tsConfigContent, null, 2) + '\n'
        );
        return tree;
      })
    );
  };
}

function addStorybookTask(projectName: string): Rule {
  return updateWorkspace(workspace => {
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
