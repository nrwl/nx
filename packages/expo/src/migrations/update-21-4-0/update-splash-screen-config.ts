import {
  Tree,
  getProjects,
  updateJson,
  logger,
  readJson,
  joinPathFragments,
} from '@nx/devkit';

/**
 * Update Expo splash screen configuration to use the new expo-splash-screen plugin format.
 * This migration handles the transition from the legacy splash screen configuration
 * to the new plugin-based format introduced in Expo SDK 53+.
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

        // Convert legacy splash configuration to plugin format
        const splashPluginConfig: any = {};

        // Map legacy properties to plugin format
        if (oldSplash.image || oldSplash.imageUrl) {
          splashPluginConfig.image = oldSplash.image || oldSplash.imageUrl;
        }

        if (oldSplash.backgroundColor) {
          splashPluginConfig.backgroundColor = oldSplash.backgroundColor;
        }

        if (oldSplash.resizeMode) {
          splashPluginConfig.resizeMode = oldSplash.resizeMode;
        }

        if (oldSplash.tabletImage) {
          splashPluginConfig.tabletImage = oldSplash.tabletImage;
        }

        if (oldSplash.dark) {
          splashPluginConfig.dark = oldSplash.dark;
        }

        // Add width property if image exists (common requirement)
        if (splashPluginConfig.image && !splashPluginConfig.imageWidth) {
          splashPluginConfig.imageWidth = 200; // Default width
        }

        // Initialize plugins array if it doesn't exist
        if (!config.expo.plugins) {
          config.expo.plugins = [];
        }

        // Check if expo-splash-screen plugin already exists
        const existingPluginIndex = config.expo.plugins.findIndex(
          (plugin: any) =>
            plugin === 'expo-splash-screen' ||
            (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')
        );

        if (existingPluginIndex !== -1) {
          // Update existing plugin configuration
          config.expo.plugins[existingPluginIndex] = [
            'expo-splash-screen',
            splashPluginConfig,
          ];
        } else {
          // Add new plugin configuration
          config.expo.plugins.push(['expo-splash-screen', splashPluginConfig]);
        }

        // Remove legacy splash configuration
        delete config.expo.splash;

        logger.info(
          `Migrated splash screen configuration to plugin format for ${projectName}`
        );
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
    if (content.includes('splash:') && !content.includes('plugins:')) {
      let updatedContent = content;

      // Transform splash configuration to plugin format
      // This is a basic transformation - for complex configs, manual review may be needed
      const splashRegex = /splash\s*:\s*{([^}]*)}/gs;
      const match = splashRegex.exec(content);

      if (match) {
        const splashConfig = match[1];

        // Extract properties from splash config
        const imageMatch = splashConfig.match(
          /image\s*:\s*['"`]([^'"`]+)['"`]/
        );
        const imageUrlMatch = splashConfig.match(
          /imageUrl\s*:\s*['"`]([^'"`]+)['"`]/
        );
        const backgroundColorMatch = splashConfig.match(
          /backgroundColor\s*:\s*['"`]([^'"`]+)['"`]/
        );
        const resizeModeMatch = splashConfig.match(
          /resizeMode\s*:\s*['"`]([^'"`]+)['"`]/
        );

        // Build plugin configuration
        const pluginConfig: string[] = [];

        if (imageMatch || imageUrlMatch) {
          const imageValue = imageMatch ? imageMatch[1] : imageUrlMatch[1];
          pluginConfig.push(`      image: '${imageValue}'`);
          pluginConfig.push(`      imageWidth: 200`);
        }

        if (backgroundColorMatch) {
          pluginConfig.push(
            `      backgroundColor: '${backgroundColorMatch[1]}'`
          );
        }

        if (resizeModeMatch) {
          pluginConfig.push(`      resizeMode: '${resizeModeMatch[1]}'`);
        }

        if (pluginConfig.length > 0) {
          const pluginConfigString = `plugins: [
    [
      'expo-splash-screen',
      {
${pluginConfig.join(',\n')}
      }
    ]
  ]`;

          // Replace splash config with plugin config
          updatedContent = updatedContent.replace(
            splashRegex,
            pluginConfigString
          );

          // Add migration comment
          const migrationComment = `
/*
 * Note: Splash screen configuration has been migrated to use expo-splash-screen plugin.
 * Please review the generated configuration and adjust as needed.
 * For more information, see: https://docs.expo.dev/develop/user-interface/splash-screen/
 */
`;

          if (!content.includes('migrated to use expo-splash-screen plugin')) {
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
              updatedContent = lines.join('\n');
            }
          }

          tree.write(configPath, updatedContent);
          logger.info(
            `Migrated splash screen configuration to plugin format for ${projectName}`
          );
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to update JS/TS config for ${projectName}: ${error}`);
  }
}
