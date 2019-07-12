import {
  chain,
  externalSchematic,
  Rule,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';
import { safeFileDelete, parseJsonAtPath } from '../../utils/utils';
import { Observable, of } from 'rxjs';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { getProject } from '@schematics/angular/utility/project';
import {
  updateWorkspace,
  getWorkspace
} from '@schematics/angular/utility/config';

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
      getProject(tree, projectName).sourceRoot + '/integration/app.spec.ts'
    );
    safeFileDelete(
      tree,
      getProject(tree, projectName).sourceRoot + '/support/app.po.ts'
    );

    return tree;
  };
}

function addBaseUrlToCypressConfig(projectName: string): Rule {
  return (tree: Tree, context: SchematicContext): void | Tree => {
    const cypressConfigPath =
      getProject(tree, projectName).root + '/cypress.json';
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
  return (tree: Tree): void | Tree => {
    const workspace = getWorkspace(tree);
    const e2eTarget = workspace.projects[e2eProjectName].architect.e2e;
    workspace.projects[e2eProjectName].architect.e2e = {
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
    return <any>updateWorkspace(workspace);
  };
}
