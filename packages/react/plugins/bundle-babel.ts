import { join } from 'path';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

// TODO(jack): Remove this in Nx 13 since it is no longer needed with `.babelrc` changes
function getRollupBabelOptions(babelOptions: any) {
  // Add react babel preset
  const idx = babelOptions.presets.findIndex(
    (p) => Array.isArray(p) && p[0].indexOf('@babel/preset-env') !== -1
  );
  babelOptions.presets.splice(idx + 1, 0, [
    require.resolve('@babel/preset-react'),
    {
      useBuiltIns: true,
    },
  ]);

  // Add babel plugin for styled-components or emotion.
  // We don't have a good way to know when a project uses one or the other, so
  // add the plugin only if the other style package isn't used.
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const hasStyledComponents = !!deps['styled-components'];
  const hasEmotion = !!deps['@emotion/react'];
  if (hasStyledComponents && !hasEmotion) {
    babelOptions.plugins.splice(0, 0, [
      require.resolve('babel-plugin-styled-components'),
      {
        pure: true,
      },
    ]);
  }
  if (hasEmotion && !hasStyledComponents) {
    babelOptions.plugins.splice(0, 0, require.resolve('babel-plugin-emotion'));
  }
  return babelOptions;
}

module.exports = getRollupBabelOptions;
