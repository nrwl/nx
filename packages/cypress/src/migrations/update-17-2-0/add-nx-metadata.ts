/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  glob,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import { createNodes, NxCypressMetadata } from '../../plugins/plugin';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { dirname } from 'path';

export default async function update(tree: Tree) {
  const configFiles = glob(tree, [createNodes[0]]);

  const proj = Object.fromEntries(getProjects(tree).entries());

  const rootMappings = createProjectRootMappingsFromProjectConfigurations(proj);

  for (const configFile of configFiles) {
    const siblings = tree.children(dirname(configFile));
    if (!siblings.includes('project.json')) {
      continue;
    }

    const projectName = findProjectForPath(configFile, rootMappings);
    const projectConfig = readProjectConfiguration(tree, projectName);
    const e2eTarget: TargetConfiguration<CypressExecutorOptions> =
      projectConfig.targets?.e2e;

    if (!e2eTarget || e2eTarget.executor !== '@nx/cypress:cypress') {
      continue;
    }

    const nxMetadata: NxCypressMetadata = {};

    nxMetadata.devServerTarget = e2eTarget.options?.devServerTarget;
    nxMetadata.productionDevServerTarget =
      e2eTarget.configurations?.production?.devServerTarget;
    nxMetadata.ciDevServerTarget =
      e2eTarget.configurations?.ci?.devServerTarget;

    if (Object.values(nxMetadata).filter((v) => !!v).length > 0) {
      let contents = tree.read(configFile, 'utf-8');

      contents =
        `import type { NxCypressMetadata } from '@nx/cypress/plugin';\n` +
        contents +
        `

      /**
       * This is metadata for the @nx/cypress/plugin
       */
      export const nx: NxCypressMetadata = ${JSON.stringify(
        nxMetadata,
        null,
        2
      )};`;

      tree.write(configFile, contents);
    }
  }

  await formatFiles(tree);
}
