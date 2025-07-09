import {
  Tree,
  getProjects,
  updateJson,
  logger,
  readJson,
  joinPathFragments,
} from '@nx/devkit';

/**
 * Update Expo splash screen configuration to use the new expo-splash-screen format.
 * This migration handles the transition from the legacy splash screen configuration
 * to the new format introduced in Expo SDK 53+.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, config] of projects.entries()) {
    // Only process Expo projects
    if (
      config.projectType !== 'application' ||
      !isExpoProject(tree, config.root)
    ) {
      continue;
    }

    const appConfigPath = joinPathFragments(config.root, 'app.json');
    const appConfigTsPath = joinPathFragments(config.root, 'app.config.ts');
    const appConfigJsPath = joinPathFragments(config.root, 'app.config.js');

    // Check which config file exists
    let configPath: string | null = null;
    if (tree.exists(appConfigPath)) {
      configPath = appConfigPath;
    } else if (tree.exists(appConfigTsPath)) {
      configPath = appConfigTsPath;
    } else if (tree.exists(appConfigJsPath)) {
      configPath = appConfigJsPath;
    }

    if (!configPath) {
      continue;
    }

    // Handle JSON config files
    if (configPath.endsWith('.json')) {
      updateJsonSplashScreenConfig(tree, configPath, projectName);
    } else {
      // Handle JS/TS config files
      updateJsConfigSplashScreenConfig(tree, configPath, projectName);
    }
  }
}

function isExpoProject(tree: Tree, projectRoot: string): boolean {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (!tree.exists(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = readJson(tree, packageJsonPath);
    return (
      packageJson.dependencies?.expo ||
      packageJson.devDependencies?.expo ||
      packageJson.dependencies?.['expo-splash-screen'] ||
      packageJson.devDependencies?.['expo-splash-screen']
    );
  } catch {
    return false;
  }
}

function updateJsonSplashScreenConfig(
  tree: Tree,
  configPath: string,
  projectName: string
) {
  try {
    updateJson(tree, configPath, (config) => {
      if (config.expo?.splash) {
        const oldSplash = config.expo.splash;

        // Check if already using new format
        if (
          oldSplash.image ||
          oldSplash.backgroundColor ||
          oldSplash.resizeMode
        ) {
          // Convert legacy format to new format
          const newSplash: any = {};

          if (oldSplash.image) {
            newSplash.image = oldSplash.image;
          }

          if (oldSplash.backgroundColor) {
            newSplash.backgroundColor = oldSplash.backgroundColor;
          }

          if (oldSplash.resizeMode) {
            newSplash.resizeMode = oldSplash.resizeMode;
          }

          // Handle legacy properties that need to be moved or updated
          if (oldSplash.imageUrl) {
            newSplash.image = oldSplash.imageUrl;
            delete oldSplash.imageUrl;
          }

          if (oldSplash.tabletImage) {
            newSplash.tabletImage = oldSplash.tabletImage;
          }

          if (oldSplash.dark) {
            newSplash.dark = oldSplash.dark;
          }

          config.expo.splash = newSplash;

          logger.info(`Updated splash screen configuration for ${projectName}`);
        }
      }

      return config;
    });
  } catch (error) {
    logger.warn(
      `Failed to update splash screen configuration for ${projectName}: ${error}`
    );
  }
}

function updateJsConfigSplashScreenConfig(
  tree: Tree,
  configPath: string,
  projectName: string
) {
  try {
    const content = tree.read(configPath, 'utf-8');

    // Check if the file contains legacy splash screen configuration
    if (content.includes('imageUrl') || content.includes('splash:')) {
      // For JS/TS config files, we'll add a comment about the migration
      const updatedContent = content.replace(
        /\/\*\s*splash screen configuration\s*\*\//gi,
        ''
      );

      const migrationComment = `
/*
 * Note: Expo splash screen configuration has been updated.
 * Please review your splash screen configuration to ensure it follows
 * the new format introduced in Expo SDK 53+.
 * 
 * Legacy properties like 'imageUrl' should be changed to 'image'.
 * For more information, see: https://docs.expo.dev/develop/user-interface/splash-screen/
 */
`;

      // Add the comment at the top of the file if not already present
      if (!content.includes('splash screen configuration has been updated')) {
        const lines = updatedContent.split('\n');
        const importEndIndex = lines.findIndex(
          (line) =>
            !line.trim().startsWith('import') &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('/*') &&
            line.trim() !== ''
        );

        if (importEndIndex !== -1) {
          lines.splice(importEndIndex, 0, migrationComment);
          tree.write(configPath, lines.join('\n'));
          logger.info(`Added migration comment to ${projectName} config file`);
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to update JS/TS config for ${projectName}: ${error}`);
  }
}
