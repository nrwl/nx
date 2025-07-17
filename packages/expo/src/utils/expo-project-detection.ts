import { Tree, joinPathFragments } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface ExpoProjectDetectionResult {
  isExpo: boolean;
  reason?: string;
}

async function getAppConfig(
  tree: Tree,
  projectRoot: string,
  appConfigPath: string
): Promise<any> {
  const absolutePath = joinPathFragments(tree.root, projectRoot, appConfigPath);
  return loadConfigFile(absolutePath);
}

export async function isExpoProject(
  tree: Tree,
  projectRoot: string
): Promise<ExpoProjectDetectionResult> {
  // Check for required files
  const requiredFiles = ['metro.config.js', 'package.json'];

  const appConfigFiles = ['app.json', 'app.config.js', 'app.config.ts'];

  // Check if all required files exist
  for (const file of requiredFiles) {
    const filePath = joinPathFragments(projectRoot, file);
    if (!tree.exists(filePath)) {
      return {
        isExpo: false,
        reason: `Missing required file: ${file}`,
      };
    }
  }

  // Check if at least one app config file exists
  let appConfigExists = false;
  let appConfigPath: string | null = null;

  for (const file of appConfigFiles) {
    const filePath = joinPathFragments(projectRoot, file);
    if (tree.exists(filePath)) {
      appConfigExists = true;
      appConfigPath = file; // Store just the filename, not the full path
      break;
    }
  }

  if (!appConfigExists) {
    return {
      isExpo: false,
      reason:
        'Missing app config file (app.json, app.config.js, or app.config.ts)',
    };
  }

  // Read package.json to check for Expo dependencies
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  let packageJson: any;

  try {
    packageJson = JSON.parse(tree.read(packageJsonPath, 'utf-8'));
  } catch (error) {
    return {
      isExpo: false,
      reason: 'Failed to parse package.json',
    };
  }

  const hasExpoDependency =
    packageJson.dependencies?.['expo'] || packageJson.devDependencies?.['expo'];

  // Now, check app config for Expo configuration. This is less strict now, allowing .js and .ts files.
  let appConfigHasExpoField = false;
  let appConfigParseFailed = false;

  if (appConfigPath) {
    const appConfig = await getAppConfig(tree, projectRoot, appConfigPath);
    if (appConfig === null) {
      appConfigParseFailed = true;
    } else if (appConfig?.expo) {
      appConfigHasExpoField = true;
    }
  }

  if (appConfigParseFailed) {
    return {
      isExpo: false,
      reason: 'Failed to parse app config file',
    };
  }

  // Final check: either dependency AND app config can make it an Expo project now
  if (hasExpoDependency && appConfigHasExpoField) {
    return {
      isExpo: true,
      reason:
        hasExpoDependency && appConfigHasExpoField
          ? 'Project has Expo dependency and Expo configuration in app config'
          : hasExpoDependency
          ? 'Project has Expo dependency'
          : 'App config has Expo configuration',
    };
  }

  // If we reach here, it's not an Expo project based on the criteria.
  return {
    isExpo: false,
    reason: 'No Expo dependency or configuration found',
  };
}
