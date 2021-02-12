import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { join } from 'path';

export function updateBabelOptions(options: any): void {
  // Add react babel preset
  const idx = options.presets.findIndex(
    (p) => Array.isArray(p) && p[0].indexOf('@babel/preset-env') !== -1
  );
  options.presets.splice(idx + 1, 0, [
    require.resolve('@babel/preset-react'),
    {
      useBuiltIns: true,
    },
  ]);

  // TODO: Remove this once we have composable webpack and babel plugins.

  // Add babel plugin for styled-components or emotion.
  // We don't have a good way to know when a project uses one or the other, so
  // add the plugin only if the other style package isn't used.
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const hasStyledComponents = !!deps['styled-components'];
  const hasEmotion = !!deps['@emotion/react'];
  if (hasStyledComponents && !hasEmotion) {
    options.plugins.splice(0, 0, [
      require.resolve('babel-plugin-styled-components'),
      {
        pure: true,
      },
    ]);
  }
  if (hasEmotion && !hasStyledComponents) {
    options.plugins.splice(0, 0, require.resolve('babel-plugin-emotion'));
  }

  return options;
}
