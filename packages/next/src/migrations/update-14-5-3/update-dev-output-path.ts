import {
  formatFiles,
  getProjects,
  joinPathFragments,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((config, name) => {
    if (config.targets?.build?.executor === '@nrwl/next:build') {
      config.targets.build.configurations ??= {};
      config.targets.build.configurations.development ??= {};
      if (
        !config.targets.build.configurations.development.outputPath ||
        config.targets.build.configurations.development.outputPath ===
          joinPathFragments('tmp', config.root)
      ) {
        config.targets.build.configurations.development.outputPath =
          config.root;
        updateProjectConfiguration(tree, name, config);
      }
    }
  });

  await formatFiles(tree);
}

export default update;
