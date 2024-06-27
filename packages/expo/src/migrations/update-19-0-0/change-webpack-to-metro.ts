import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  updateJson,
} from '@nx/devkit';

/**
 * Migration:
 * - change target 'export-web'
 * - change bundler to 'metro'
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      if (config.targets['web']) {
        delete config.targets['web'];
      }
      if (config.targets['export-web']) {
        config.targets['export-web'].options.bundler = 'metro';
      }

      if (tree.exists(`${config.root}/app.json`)) {
        updateJson(tree, `${config.root}/app.json`, (appJson) => {
          if (appJson.expo?.web) {
            appJson.expo.web.bundler = 'metro';
          }
          return appJson;
        });
      }
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
