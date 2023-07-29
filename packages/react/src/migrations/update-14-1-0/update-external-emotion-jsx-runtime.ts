import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export async function updateExternalEmotionJsxRuntime(tree: Tree) {
  forEachExecutorOptions<any>(
    tree,
    '@nrwl/web:rollup',
    (options: any, projectName, targetName, configurationName) => {
      const projectConfiguration = readProjectConfiguration(tree, projectName);
      const config = configurationName
        ? projectConfiguration.targets[targetName].configurations[
            configurationName
          ]
        : projectConfiguration.targets[targetName].options;

      if (config.external && config.external.length > 0) {
        const hasEmotionStyledBase = config.external.includes(
          '@emotion/styled/base'
        );
        const hasReactJsxRuntime =
          config.external.includes('react/jsx-runtime');

        if (hasEmotionStyledBase && hasReactJsxRuntime) {
          // Replace 'react/jsx-runtime' with '@emotion/react/jsx-runtime'
          config.external.forEach((value, index) => {
            if (value === 'react/jsx-runtime') {
              config.external.splice(index, 1, '@emotion/react/jsx-runtime');
            }
          });

          // Remove '@emotion/styled/base'
          config.external.forEach((value, index) => {
            if (value === '@emotion/styled/base') {
              config.external.splice(index, 1);
            }
          });
        }

        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    }
  );
}

export default updateExternalEmotionJsxRuntime;
