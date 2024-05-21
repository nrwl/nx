import { getE2eProjectName } from '@nx/cypress/src/utils/project-name';
import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { join } from 'path';

import { safeFileDelete } from '../../utils/utilities';
import { nxVersion } from '../../utils/versions';

export interface CypressConfigureSchema {
  name: string;
  js?: boolean;
  directory?: string;
  linter: Linter;
  standaloneConfig?: boolean;
  ciTargetName?: string;
  skipFormat?: boolean;
  projectNameAndRootFormat?: 'as-provided' | 'derived';
}

export async function cypressProjectGenerator(
  tree: Tree,
  schema: CypressConfigureSchema
) {
  return await cypressProjectGeneratorInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function cypressProjectGeneratorInternal(
  tree: Tree,
  schema: CypressConfigureSchema
) {
  logger.warn(
    `Use 'interactionTests' instead when running '@nx/storybook:configuration'. This generator will be removed in v21.`
  );
  const { configurationGenerator } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);

  const e2eName = schema.name ? `${schema.name}-e2e` : undefined;
  const { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    tree,
    {
      name: e2eName,
      projectType: 'application',
      directory: schema.directory,
      projectNameAndRootFormat: schema.projectNameAndRootFormat,
      callingGenerator: '@nx/storybook:cypress-project',
    }
  );
  const libConfig = readProjectConfiguration(tree, schema.name);
  const libRoot = libConfig.root;

  addProjectConfiguration(tree, projectName, {
    root: projectRoot,
    projectType: 'application',
    sourceRoot: joinPathFragments(projectRoot, 'src'),
    targets: {},
    implicitDependencies: [projectName],
  });

  const cypressTask = await configurationGenerator(tree, {
    project: projectName,
    js: schema.js,
    linter: schema.linter,
    devServerTarget: `${schema.name}:storybook`,
    skipFormat: true,
  });

  const generatedCypressProjectName = getE2eProjectName(
    schema.name,
    libRoot,
    schema.directory
  );
  removeUnneededFiles(tree, generatedCypressProjectName, schema.js);

  const project = readProjectConfiguration(tree, generatedCypressProjectName);
  if (project.targets.e2e && project.targets.e2e.options) {
    addBaseUrlToCypressConfig(tree, generatedCypressProjectName, project.root);
    updateAngularJsonBuilder(tree, {
      e2eProjectName: generatedCypressProjectName,
      targetProjectName: schema.name,
      ciTargetName: schema.ciTargetName,
    });
  } else if (hasCypressPlugin(tree)) {
    generateCypressConfigForInferredPlugin(
      tree,
      generatedCypressProjectName,
      project.root,
      schema.name,
      schema.ciTargetName
    );
  } else {
    throw new Error(
      `Unable to generate Cypress Project for Storybook project. Please report this issue at https://github.com/nrwl/nx/issues/new/choose`
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return cypressTask;
}

function hasCypressPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  return nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );
}

function removeUnneededFiles(tree: Tree, projectName: string, js: boolean) {
  const { sourceRoot, root } = readProjectConfiguration(tree, projectName);
  const fileType = js ? 'js' : 'ts';
  if (tree.exists(joinPathFragments(root, 'cypress.config.ts'))) {
    safeFileDelete(tree, `${sourceRoot}/e2e/app.cy.${fileType}`);
    safeFileDelete(tree, `${sourceRoot}/support/app.po.${fileType}`);
  } else {
    safeFileDelete(tree, `${sourceRoot}/integration/app.spec.${fileType}`);
    safeFileDelete(tree, `${sourceRoot}/support/app.po.${fileType}`);
  }
}

function generateCypressConfigForInferredPlugin(
  tree: Tree,
  projectName: string,
  projectRoot: string,
  targetProjectName: string,
  ciTargetName?: string
) {
  const cypressJson = joinPathFragments(projectRoot, 'cypress.json');
  const cypressTs = joinPathFragments(projectRoot, 'cypress.config.ts');

  if (tree.exists(cypressJson)) {
    tree.delete(cypressJson);
  }
  if (tree.exists(cypressTs)) {
    // cypress >= v10
    tree.delete(cypressTs);
    generateFiles(
      tree,
      join(__dirname, 'files', 'inferred-target'),
      projectRoot,
      {
        defaultWebServerCommand: `npx nx run ${targetProjectName}:storybook`,
        ciWebServerCommand: ciTargetName
          ? `npx nx run ${targetProjectName}:${ciTargetName}:ci`
          : `npx nx run ${targetProjectName}:storybook:ci`,
        tpl: '',
      }
    );
  }
}

function addBaseUrlToCypressConfig(
  tree: Tree,
  projectName: string,
  projectRoot: string
) {
  const cypressJson = joinPathFragments(projectRoot, 'cypress.json');
  const cypressTs = joinPathFragments(projectRoot, 'cypress.config.ts');
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
    generateFiles(
      tree,
      join(__dirname, 'files', 'explicit-target'),
      projectRoot,
      {
        tpl: '',
      }
    );
  }
}

function updateAngularJsonBuilder(
  tree: Tree,
  opts: {
    e2eProjectName: string;
    targetProjectName: string;
    ciTargetName?: string;
  }
) {
  const project = readProjectConfiguration(tree, opts.e2eProjectName);
  const e2eTarget = project.targets.e2e ?? {};
  project.targets.e2e = {
    ...e2eTarget,
    options: <any>{
      ...e2eTarget.options,
      devServerTarget: `${opts.targetProjectName}:storybook`,
    },
    configurations: {
      ci: {
        devServerTarget: opts.ciTargetName
          ? `${opts.targetProjectName}:${opts.ciTargetName}:ci`
          : `${opts.targetProjectName}:storybook:ci`,
      },
    },
  };
  updateProjectConfiguration(tree, opts.e2eProjectName, project);
}

function projectAlreadyHasCypress(tree: Tree): boolean {
  const packageJsonContents = readJson(tree, 'package.json');
  return (
    (packageJsonContents?.['devDependencies']?.['@nx/cypress'] ||
      packageJsonContents?.['dependencies']?.['@nx/cypress'] ||
      packageJsonContents?.['devDependencies']?.['@nrwl/cypress'] ||
      packageJsonContents?.['dependencies']?.['@nrwl/cypress']) &&
    (packageJsonContents?.['devDependencies']?.['cypress'] ||
      packageJsonContents?.['dependencies']?.['cypress'])
  );
}

export default cypressProjectGenerator;
