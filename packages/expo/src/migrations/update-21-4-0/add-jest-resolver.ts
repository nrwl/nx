import { formatFiles, getProjects, Tree } from '@nx/devkit';
import { join } from 'path';
import { updateTsConfigFiles } from '../../utils/update-tsconfig-files';
import { isExpoProject } from '../../utils/expo-project-detection';

export default async function addJestResolver(tree: Tree) {
  const projects = getProjects(tree);

  for (const [, config] of projects) {
    if (config.targets?.test?.executor === '@nx/jest:jest') {
      // Check if this is an Expo project
      const expoProjectDetectionResult = isExpoProject(tree, config.root);
      if (!(await expoProjectDetectionResult).isExpo) {
        continue;
      }

      // Check if this is an Expo project by looking for jest.config file with expo preset
      const jestConfigPath = join(config.root, 'jest.config.ts');
      const jestConfigJsPath = join(config.root, 'jest.config.js');

      let jestConfigContent = '';
      let configPath = '';

      if (tree.exists(jestConfigPath)) {
        jestConfigContent = tree.read(jestConfigPath, 'utf-8');
        configPath = jestConfigPath;
      } else if (tree.exists(jestConfigJsPath)) {
        jestConfigContent = tree.read(jestConfigJsPath, 'utf-8');
        configPath = jestConfigJsPath;
      }

      if (jestConfigContent && jestConfigContent.includes('jest-expo')) {
        // This is an Expo project with Jest configuration
        const resolverPath = join(config.root, 'jest.resolver.js');

        // Create the custom resolver if it doesn't exist
        if (!tree.exists(resolverPath)) {
          const resolverContent = `const defaultResolver = require('@nx/jest/plugins/resolver');

module.exports = (request, options) => {
  // Check if we're resolving from the winter directory and request is for runtime
  if (options.basedir && options.basedir.includes('expo/src/winter') && request === './runtime') {
    // Force resolution to non-native version to avoid runtime.native.ts
    return defaultResolver('./runtime.ts', options);
  }
  
  return defaultResolver(request, options);
};`;

          tree.write(resolverPath, resolverContent);
        }

        // Update Jest config to use custom resolver
        if (configPath && jestConfigContent) {
          const updatedConfig = jestConfigContent.replace(
            /resolver:\s*['"]@nx\/jest\/plugins\/resolver['"],?/,
            "resolver: require.resolve('./jest.resolver.js'),"
          );

          tree.write(configPath, updatedConfig);
        }

        // Update tsconfig files to handle jest.resolver.js properly
        updateTsConfigFiles(tree, config.name, config.root);
      }
    }
  }

  await formatFiles(tree);
}
