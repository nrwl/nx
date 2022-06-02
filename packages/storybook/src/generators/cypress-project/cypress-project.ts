import {
  cypressInitGenerator as _cypressInitGenerator,
  cypressProjectGenerator as _cypressProjectGenerator,
} from '@nrwl/cypress';
import {
  getE2eProjectName,
  getUnscopedLibName,
} from '@nrwl/cypress/src/utils/project-name';
import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { join } from 'path';
import { safeFileDelete } from '../../utils/utilities';

export interface CypressConfigureSchema {
  name: string;
  js?: boolean;
  directory?: string;
  linter: Linter;
  standaloneConfig?: boolean;
}

export async function cypressProjectGenerator(
  tree: Tree,
  schema: CypressConfigureSchema
) {
  const libConfig = readProjectConfiguration(tree, schema.name);
  const libRoot = libConfig.root;
  const cypressProjectName = `${
    schema.directory ? getUnscopedLibName(libRoot) : schema.name
  }-e2e`;

  const tasks: GeneratorCallback[] = [];

  if (!projectAlreadyHasCypress(tree)) {
    tasks.push(_cypressInitGenerator(tree, {}));
  }

  const installTask = await _cypressProjectGenerator(tree, {
    name: cypressProjectName,
    project: schema.name,
    js: schema.js,
    linter: schema.linter,
    directory: schema.directory,
    standaloneConfig: schema.standaloneConfig,
  });
  tasks.push(installTask);

  const generatedCypressProjectName = getE2eProjectName(
    schema.name,
    libRoot,
    schema.directory
  );
  removeUnneededFiles(tree, generatedCypressProjectName, schema.js);
  addBaseUrlToCypressConfig(tree, generatedCypressProjectName);
  updateAngularJsonBuilder(tree, generatedCypressProjectName, schema.name);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function removeUnneededFiles(tree: Tree, projectName: string, js: boolean) {
  const { sourceRoot, root } = readProjectConfiguration(tree, projectName);
  const fileType = js ? 'js' : 'ts';
  if (tree.exists(join(root, 'cypress.config.ts'))) {
    safeFileDelete(tree, `${sourceRoot}/e2e/app.cy.${fileType}`);
    safeFileDelete(tree, `${sourceRoot}/support/app.po.${fileType}`);
  } else {
    safeFileDelete(tree, `${sourceRoot}/integration/app.spec.${fileType}`);
    safeFileDelete(tree, `${sourceRoot}/support/app.po.${fileType}`);
  }
}

function addBaseUrlToCypressConfig(tree: Tree, projectName: string) {
  const projectRoot = readProjectConfiguration(tree, projectName).root;
  const cypressJson = join(projectRoot, 'cypress.json');
  const cypressTs = join(projectRoot, 'cypress.config.ts');
  // TODO(caleb): remove this when cypress < v10 is deprecated

  if (tree.exists(cypressJson)) {
    // cypress < v10
    updateJson(tree, cypressJson, (json) => {
      json.baseUrl = 'http://localhost:4400';
      return json;
    });
  } else if (tree.exists(cypressTs)) {
    // cypress >= v10
    tree.delete(cypressTs);
    generateFiles(tree, joinPathFragments(__dirname, 'files'), projectRoot, {
      tpl: '',
    });
  }
}

function updateAngularJsonBuilder(
  tree: Tree,
  e2eProjectName: string,
  targetProjectName: string
) {
  const project = readProjectConfiguration(tree, e2eProjectName);
  const e2eTarget = project.targets.e2e;
  project.targets.e2e = {
    ...e2eTarget,
    options: <any>{
      ...e2eTarget.options,
      devServerTarget: `${targetProjectName}:storybook`,
    },
    configurations: {
      ci: {
        devServerTarget: `${targetProjectName}:storybook:ci`,
      },
    },
  };
  updateProjectConfiguration(tree, e2eProjectName, project);
}

function projectAlreadyHasCypress(tree: Tree): boolean {
  const packageJsonContents = readJson(tree, 'package.json');
  return (
    (packageJsonContents?.['devDependencies']?.['@nrwl/cypress'] ||
      packageJsonContents?.['dependencies']?.['@nrwl/cypress']) &&
    (packageJsonContents?.['devDependencies']?.['cypress'] ||
      packageJsonContents?.['dependencies']?.['cypress'])
  );
}

export default cypressProjectGenerator;
export const cypressProjectSchematic = convertNxGenerator(
  cypressProjectGenerator
);
