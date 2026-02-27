import { Tree, updateJson, logger, readJson, formatFiles } from '@nx/devkit';
import { clean, coerce, major } from 'semver';

/**
 * Remove @config-plugins/detox for Expo 54+ projects.
 *
 * The @config-plugins/detox package has been discontinued and is incompatible
 * with Expo 54. See: https://github.com/expo/config-plugins/pull/290
 *
 * This migration removes the dependency from package.json for projects
 * using Expo 54 or above.
 */
export default async function update(tree: Tree) {
  const rootPackageJsonPath = 'package.json';

  if (!tree.exists(rootPackageJsonPath)) {
    return;
  }

  const packageJson = readJson(tree, rootPackageJsonPath);

  // Check if @config-plugins/detox is installed
  const hasConfigPluginsDetox =
    packageJson.dependencies?.['@config-plugins/detox'] ||
    packageJson.devDependencies?.['@config-plugins/detox'];

  if (!hasConfigPluginsDetox) {
    return;
  }

  // Check the installed Expo version
  const expoVersion =
    packageJson.dependencies?.['expo'] || packageJson.devDependencies?.['expo'];

  if (!expoVersion) {
    // No expo installed, this is likely a React Native project, skip
    return;
  }

  const cleanedVersion = clean(expoVersion) ?? coerce(expoVersion)?.version;
  if (!cleanedVersion) {
    logger.warn(
      `Could not parse Expo version "${expoVersion}". Skipping @config-plugins/detox removal.`
    );
    return;
  }

  const majorVersion = major(cleanedVersion);

  if (majorVersion < 54) {
    // Expo 53 or below still supports @config-plugins/detox
    return;
  }

  // Remove @config-plugins/detox from package.json
  updateJson(tree, rootPackageJsonPath, (json) => {
    if (json.dependencies?.['@config-plugins/detox']) {
      delete json.dependencies['@config-plugins/detox'];
    }
    if (json.devDependencies?.['@config-plugins/detox']) {
      delete json.devDependencies['@config-plugins/detox'];
    }
    return json;
  });

  logger.warn(
    `Removed @config-plugins/detox from package.json.\n` +
      `The @config-plugins/detox package has been discontinued and is incompatible with Expo 54+.\n` +
      `For E2E testing with Expo 54+, consider using Maestro: https://docs.expo.dev/build-reference/e2e-tests/`
  );

  await formatFiles(tree);
}
