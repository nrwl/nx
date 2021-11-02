import {
  formatFiles,
  getProjects,
  Tree,
  readJson,
  updateJson,
} from '@nrwl/devkit';

export async function updateEmotionSetup(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((p) => {
    let hasEmotion = false;
    const babelrcPath = `${p.root}/.babelrc`;
    const tsConfigPath = `${p.root}/tsconfig.json`;

    if (host.exists(babelrcPath)) {
      const babelrc = readJson(host, babelrcPath);
      if (babelrc.presets) {
        for (const [idx, preset] of babelrc.presets.entries()) {
          if (Array.isArray(preset)) {
            if (!preset[0].includes('@nrwl/next/babel')) continue;
            const emotionOptions = preset[1]['preset-react'];
            hasEmotion = emotionOptions?.importSource === '@emotion/react';
            break;
          }
        }
      }
    }

    if (hasEmotion && host.exists(tsConfigPath)) {
      updateJson(host, tsConfigPath, (json) => {
        json.compilerOptions.jsxImportSource = '@emotion/react';
        return json;
      });
    }
  });

  await formatFiles(host);
}

export default updateEmotionSetup;
