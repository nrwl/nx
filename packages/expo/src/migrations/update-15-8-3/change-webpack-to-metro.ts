import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';

/**
 * Change webpack to metro
 * - change target export-web
 * - delete webpack.config.js
 * - delete @expo/webpack-config dependency
 * - add target update
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/expo:start') {
      if (config.targets['web']) {
        delete config.targets['web'];
      }
      if (config.targets['export-web']) {
        config.targets['export-web'].options.bundler = 'metro';
      }

      tree.delete(`${config.root}/webpack.config.js`);

      updateJson(tree, 'package.json', (json) => {
        delete json.dependencies['@expo/webpack-config'];
        return json;
      });

      updateJson(tree, `${config.root}/app.json`, (appJson) => {
        if (appJson.expo?.web) {
          appJson.expo.web.bundler = 'metro';
        }
        return appJson;
      });
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
