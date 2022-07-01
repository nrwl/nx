import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';
import { getMFProjects } from '../../utils/get-mf-projects';

export default async function (tree: Tree) {
  const projects = getMFProjects(tree);

  for (const project of projects) {
    const e2eProjectName = `${project}-e2e`;
    let e2eProject: ProjectConfiguration;
    try {
      e2eProject = readProjectConfiguration(tree, e2eProjectName);
    } catch {
      continue;
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

  await formatFiles(tree);
}
