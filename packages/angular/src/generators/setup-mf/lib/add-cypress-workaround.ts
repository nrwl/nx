// This is a temporary workaround to prevent cypress erroring
// as Angular attempt to figure out how to fix HMR when styles.js
// is attached to the index.html with type=module

import type { ProjectConfiguration, Tree } from '@nx/devkit';
import {
  glob,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  stripIndents,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { Schema } from '../schema';

export function addCypressOnErrorWorkaround(tree: Tree, schema: Schema) {
  if (!schema.e2eProjectName) {
    return;
  }

  const e2eProjectName = schema.e2eProjectName;
  let e2eProject: ProjectConfiguration;

  try {
    e2eProject = readProjectConfiguration(tree, e2eProjectName);
  } catch {
    logger.warn(stripIndents`Could not find an associated e2e project for ${schema.appName} with name ${e2eProjectName}.
    If there is an associated e2e project for this application, and it uses Cypress, you will need to add a workaround to allow Cypress to test correctly.
    An error will be thrown in the console when you serve the application, coming from styles.js. It is an error that can be safely ignored and will not reach production due to how production builds of Angular are created.
    You can find how to implement that workaround here: https://docs.cypress.io/api/events/catalog-of-events#Uncaught-Exceptions
    `);
    return;
  }

  if (e2eProject.targets?.e2e?.executor !== '@nx/cypress:cypress') {
    try {
      // don't ensure package is installed, if it's not installed, we don't need to add the workaround
      const {
        CYPRESS_CONFIG_FILE_NAME_PATTERN,
      } = require('@nx/cypress/src/utils/config');
      if (
        !glob(tree, [`${e2eProject.root}/${CYPRESS_CONFIG_FILE_NAME_PATTERN}`])
          .length
      ) {
        // Not a cypress e2e project, skip
        return;
      }
    } catch {
      // assume cypress is not installed
      return;
    }
  }

  const commandToAdd = `Cypress.on('uncaught:exception', err => {
    if (err.message.includes(\`Cannot use 'import.meta' outside a module\`)) {
      return false;
    }
    return true;
  });`;

  const pathToCommandsFile = joinPathFragments(
    getProjectSourceRoot(e2eProject, tree),
    'support/e2e.ts'
  );

  const commandsContent = tree.exists(pathToCommandsFile)
    ? tree.read(pathToCommandsFile, 'utf-8')
    : '';
  tree.write(pathToCommandsFile, `${commandsContent}\n${commandToAdd}`);
}
