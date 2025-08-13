import { Tree, joinPathFragments } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface ReactNativeProjectDetectionResult {
  isReactNative: boolean;
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

/**
 * Determines if a project is a React Native project by checking for specific files
 * and ensuring it's not an Expo project
 */
export async function isReactNativeProject(
  tree: Tree,
  projectRoot: string
): Promise<ReactNativeProjectDetectionResult> {
  // Check for required files
  const requiredFiles = ['metro.config.js', 'package.json'];

  const appConfigFiles = ['app.json', 'app.config.js', 'app.config.ts'];

  // Check if all required files exist
  for (const file of requiredFiles) {
    const filePath = joinPathFragments(projectRoot, file);
    if (!tree.exists(filePath)) {
      return {
        isReactNative: false,
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
      appConfigPath = filePath;
      break;
    }
  }

  if (!appConfigExists) {
    return {
      isReactNative: false,
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
      isReactNative: false,
      reason: 'Failed to parse package.json',
    };
  }

  // Check for Expo in dependencies
  const hasExpoDependency =
    packageJson.dependencies?.['expo'] || packageJson.devDependencies?.['expo'];

  if (hasExpoDependency) {
    return {
      isReactNative: false,
      reason: 'Project has Expo dependency - this is an Expo project',
    };
  }

  // Read app config to check for Expo configuration
  let appConfig: any;
  let appConfigParseFailed = false;

  if (appConfigPath) {
    // Extract just the filename from the full path
    const filename = appConfigPath.split('/').pop();
    try {
      appConfig = await getAppConfig(tree, projectRoot, filename);
      if (appConfig === null) {
        appConfigParseFailed = true;
      }
    } catch (error) {
      appConfigParseFailed = true;
    }
  }

  if (appConfigParseFailed) {
    return {
      isReactNative: false,
      reason: 'Failed to parse app config file',
    };
  }

  // Check if app config has Expo configuration
  if (appConfig.expo) {
    return {
      isReactNative: false,
      reason: 'App config has Expo configuration',
    };
  }

  return {
    isReactNative: true,
  };
}

/**
 * Gets all React Native projects in the workspace
 */
export async function getAllReactNativeProjects(
  tree: Tree,
  projects: Map<string, any>
): Promise<string[]> {
  const reactNativeProjects: string[] = [];

  for (const [projectName, project] of projects.entries()) {
    const detection = await isReactNativeProject(tree, project.root);
    if (detection.isReactNative) {
      reactNativeProjects.push(projectName);
    }
  }

  return reactNativeProjects;
}
