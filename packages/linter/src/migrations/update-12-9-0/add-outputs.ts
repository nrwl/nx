import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function addOutputs(tree: Tree) {
  for (const [projectName, project] of getProjects(tree)) {
    if (!project.targets) {
      continue;
    }

    for (const target of Object.values(project.targets)) {
      if (target.executor !== '@nrwl/linter:eslint' || target.outputs) {
        continue;
      }

      target.outputs = ['{options.outputFile}'];

      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
