import {
  chain,
  externalSchematic,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { getProjectConfig, updateWorkspaceInTree } from '@nrwl/workspace';
import { parseJsonAtPath, safeFileDelete } from '../../utils/utils';

export interface CypressConfigureSchema {
  name: string;
}

export default function(schema: CypressConfigureSchema): Rule {
  const e2eProjectName = schema.name + '-e2e';
  return chain([
    externalSchematic('@nrwl/cypress', 'cypress-project', {
      name: e2eProjectName,
      project: schema.name
    }),
    removeUnneededFiles(e2eProjectName),
    addBaseUrlToCypressConfig(e2eProjectName),
    updateAngularJsonBuilder(e2eProjectName, schema.name)
  ]);
}

function removeUnneededFiles(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext): Tree => {
    safeFileDelete(
      tree,
      getProjectConfig(tree, projectName).sourceRoot +
        '/integration/app.spec.ts'
    );
    safeFileDelete(
      tree,
      getProjectConfig(tree, projectName).sourceRoot + '/support/app.po.ts'
    );

    return tree;
  };
}

function addBaseUrlToCypressConfig(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext): void | Tree => {
    const cypressConfigPath =
      getProjectConfig(tree, projectName).root + '/cypress.json';
    const cypressConfig = parseJsonAtPath(tree, cypressConfigPath);

    let cypressConfigContent: any;

    if (cypressConfig && cypressConfig.value) {
      cypressConfigContent = cypressConfig.value;
    } else {
      return tree;
    }

    cypressConfigContent.baseUrl = 'http://localhost:4400';

    return tree.overwrite(
      cypressConfigPath,
      JSON.stringify(cypressConfigContent, null, 2) + '\n'
    );
  };
}

function updateAngularJsonBuilder(
  e2eProjectName: string,
  targetProjectName
): Rule {
  return updateWorkspaceInTree(workspace => {
    const project = workspace.projects[e2eProjectName];
    const e2eTarget = project.architect['e2e'];
    project.architect['e2e'] = {
      ...e2eTarget,
      options: <any>{
        ...e2eTarget.options,
        devServerTarget: `${targetProjectName}:storybook`,
        headless: false,
        watch: true
      },
      configurations: <any>{
        headless: {
          devServerTarget: `${targetProjectName}:storybook:ci`,
          headless: true
        }
      }
    };
    return workspace;
  });
}
