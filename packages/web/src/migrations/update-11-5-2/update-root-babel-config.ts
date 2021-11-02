import { formatFiles, Tree, updateJson } from '@nrwl/devkit';

export async function updateRootBabelConfig(host: Tree) {
  if (host.exists('babel.config.json')) {
    updateJson(host, 'babel.config.json', (json) => {
      if (Array.isArray(json.presets)) {
        json.presets = json.presets.filter((x) => x !== '@nrwl/web/babel');
      }
      return json;
    });
  }
  await formatFiles(host);
}

export default updateRootBabelConfig;
