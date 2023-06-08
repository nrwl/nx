import { Tree, formatFiles, getProjects, updateJson } from '@nx/devkit';

/**
 * Add detox plugin to app.json for expo
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((config) => {
    if (
      config.targets?.['start']?.executor === '@nrwl/expo:start' ||
      config.targets?.['start']?.executor === '@nx/expo:start'
    ) {
      updateJson(tree, `${config.root}/app.json`, (json) => {
        if (!json.expo.plugins) {
          json.expo.plugins = [];
        }
        json.expo.plugins.push([
          '@config-plugins/detox',
          {
            skipProguard: false,
            subdomains: ['10.0.2.2', 'localhost'],
          },
        ]);
        return json;
      });
    }
  });

  await formatFiles(tree);
}
