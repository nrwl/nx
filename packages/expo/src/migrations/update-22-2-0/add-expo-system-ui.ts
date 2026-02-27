import {
  Tree,
  getProjects,
  updateJson,
  logger,
  readJson,
  joinPathFragments,
} from '@nx/devkit';

/**
 * Add expo-system-ui to Expo projects for SDK 54.
 * expo-system-ui is now a built-in module that handles system UI colors
 * and user interface style configuration.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, config] of projects.entries()) {
    if (
      config.projectType !== 'application' ||
      !isExpoProject(tree, config.root)
    ) {
      continue;
    }

    const appPackageJsonPath = joinPathFragments(config.root, 'package.json');

    if (!tree.exists(appPackageJsonPath)) {
      continue;
    }

    const packageJson = readJson(tree, appPackageJsonPath);

    // Check if expo-system-ui is already installed
    if (
      packageJson.dependencies?.['expo-system-ui'] ||
      packageJson.devDependencies?.['expo-system-ui']
    ) {
      continue;
    }

    // Add expo-system-ui dependency
    updateJson(tree, appPackageJsonPath, (json) => {
      json.dependencies = json.dependencies || {};
      json.dependencies['expo-system-ui'] = '~6.0.0';
      return json;
    });

    logger.info(
      `Added expo-system-ui dependency to ${projectName} for SDK 54 support`
    );
  }
}

function isExpoProject(tree: Tree, projectRoot: string): boolean {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (!tree.exists(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = readJson(tree, packageJsonPath);
    return Boolean(
      packageJson.dependencies?.expo || packageJson.devDependencies?.expo
    );
  } catch {
    return false;
  }
}
