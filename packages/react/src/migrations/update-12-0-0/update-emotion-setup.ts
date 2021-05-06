import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function updateEmotionSetup(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((p) => {
    const babelrcPath = `${p.root}/.babelrc`;
    const oldPreset = '@emotion/babel-preset-css-prop';
    const newPlugin = '@emotion/babel-plugin';

    if (host.exists(babelrcPath)) {
      updateJson(host, babelrcPath, (json) => {
        if (!json.presets) return json;

        let emotionPresetIdx = -1;
        let emotionOptions: null | {} = null;

        for (const [idx, preset] of json.presets.entries()) {
          if (Array.isArray(preset)) {
            if (!preset[0].includes(oldPreset)) continue;
            emotionOptions = preset[1];
            emotionPresetIdx = idx;
            break;
          } else {
            if (!preset.includes(oldPreset)) continue;
            emotionPresetIdx = idx;
            break;
          }
        }

        if (emotionPresetIdx !== -1) {
          // Remove preset
          json.presets.splice(emotionPresetIdx, 1);

          // Add new plugin
          json.plugins ??= [];
          json.plugins.push(
            emotionOptions ? [newPlugin, emotionOptions] : newPlugin
          );

          return json;
        } else {
          return json;
        }
      });
    }
  });

  updateJson(host, 'package.json', (json) => {
    if (json.devDependencies?.['@emotion/babel-preset-css-prop']) {
      delete json.devDependencies['@emotion/babel-preset-css-prop'];
      json.devDependencies['@emotion/babel-plugin'] = '11.2.0';
    }
    // Just in case someone moved it to `dependencies`
    else if (json.dependencies?.['@emotion/babel-preset-css-prop']) {
      delete json.dependencies['@emotion/babel-preset-css-prop'];
      json.dependencies['@emotion/babel-plugin'] = '11.2.0';
    }
    return json;
  });

  await formatFiles(host);
}

export default updateEmotionSetup;
