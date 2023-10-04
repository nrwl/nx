import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  offsetFromRoot,
} from '@nx/devkit';

/**
 * Add new @expo/cli targets:
 * - add target prebuild
 * - add target install
 * - add target update
 * - replace target eject
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/expo:start') {
      if (!config.targets['prebuild']) {
        config.targets['prebuild'] = {
          executor: '@nrwl/expo:prebuild',
          options: {},
        };
      }
      if (!config.targets['install']) {
        config.targets['install'] = {
          executor: '@nrwl/expo:install',
          options: {},
        };
      }
      if (!config.targets['update']) {
        config.targets['update'] = {
          executor: '@nrwl/expo:update',
          options: {},
        };
      }
      if (!config.targets['export']) {
        config.targets['export'] = {
          executor: '@nrwl/expo:export',
          options: {
            platform: 'all',
            outputDir: `${offsetFromRoot(config.root)}dist/${config.root}`,
          },
        };
      }
      if (!config.targets['export-web']) {
        config.targets['export-web'] = {
          executor: '@nrwl/expo:export',
          options: {
            bundler: 'webpack',
          },
        };
      }
      config.targets['eject'] = {
        executor: 'nx:run-commands',
        options: {
          command: `nx prebuild ${name}`,
        },
      };
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
