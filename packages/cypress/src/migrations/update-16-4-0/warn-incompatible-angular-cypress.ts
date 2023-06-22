import type { Tree } from '@nx/devkit';
import { createProjectGraphAsync, logger, stripIndents } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { lt } from 'semver';
import type { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';

export default async function (tree: Tree) {
  const angularVersion = getInstalledAngularVersion();
  if (!angularVersion || lt(angularVersion, '16.1.0')) {
    return;
  }

  const angularProjects = await getAngularProjects();
  if (!angularProjects.length) {
    return;
  }

  let skipChecking = false;
  forEachExecutorOptions(
    tree,
    '@nx/cypress:cypress',
    (options: Partial<CypressExecutorOptions>, projectName) => {
      if (skipChecking || !angularProjects.includes(projectName)) {
        return;
      }

      if (options.testingType === 'component') {
        skipChecking = true;
        logger.warn(
          stripIndents`Some of your Angular projects are setup for Cypress Component testing.
          The current version of Cypress does not support component testing for Angular 16.1 so your tests may fail.
          If your component tests fail, here are some recommended next steps:
          
          - Revert these changes and update Nx without updating Angular ("nx migrate latest --interactive"). You can update Angular once the issue has been resolved
          - Keep these changes but temporarily disable the component tests until this issue is resolved
          
          Check https://github.com/nrwl/nx/issues/17720 for more details.

          `
        );
      }
    }
  );
}

async function getAngularProjects(): Promise<string[]> {
  const projectGraph = await createProjectGraphAsync();

  return Object.entries(projectGraph.dependencies)
    .filter(([node, dep]) =>
      dep.some(
        ({ target }) =>
          !projectGraph.externalNodes?.[node] && target === 'npm:@angular/core'
      )
    )
    .map(([projectName]) => projectName);
}

function getInstalledAngularVersion(): string {
  try {
    const {
      packageJson: { version },
    } = readModulePackageJson('@angular/core');

    return version;
  } catch {
    return null;
  }
}
