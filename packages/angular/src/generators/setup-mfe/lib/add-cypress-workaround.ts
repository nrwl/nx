// This is a temporary workaround to prevent cypress erroring
// as Angular attempt to figure out how to fix HMR when styles.js
// is attached to the index.html with type=module

import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  joinPathFragments,
  readProjectConfiguration,
  logger,
} from '@nrwl/devkit';

export function addCypressOnErrorWorkaround(tree: Tree, schema: Schema) {
  const e2eProjectName = schema.e2eProjectName ?? `${schema.appName}-e2e`;
  let e2eProject: ProjectConfiguration;

  try {
    e2eProject = readProjectConfiguration(tree, e2eProjectName);
  } catch {
    logger.warn(`Could not find an associated e2e project for ${schema.appName} with name ${e2eProjectName}. 
    If the app does have an associated Cypress e2e project, you can pass the name of it to the generator using --e2eProjectName.`);
    return;
  }

  if (e2eProject.targets.e2e.executor !== '@nrwl/cypress:cypress') {
    // Not a cypress e2e project, skip
    return;
  }

  const commandToAdd = `Cypress.on('uncaught:exception', err => {
    if (err.message.includes(\`Cannot use 'import.meta' outside a module\`)) {
      return false;
    }
    return true;
  });`;

  const pathToCommandsFile = joinPathFragments(
    e2eProject.sourceRoot,
    'support/index.ts'
  );

  const commandsContent = tree.exists(pathToCommandsFile)
    ? tree.read(pathToCommandsFile, 'utf-8')
    : '';
  tree.write(pathToCommandsFile, `${commandsContent}\n${commandToAdd}`);
}
