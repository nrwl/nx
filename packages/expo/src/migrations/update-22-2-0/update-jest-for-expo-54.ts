import {
  Tree,
  getProjects,
  updateJson,
  logger,
  readJson,
  joinPathFragments,
  formatFiles,
} from '@nx/devkit';
import { removePropertyFromJestConfig } from '@nx/jest';
import { join } from 'path';

/**
 * Update Jest configuration for Expo SDK 54.
 *
 * Expo 54 requires a different approach for Jest configuration:
 * - Remove the custom resolver from jest.config
 * - Delete the jest.resolver.js file
 * - Add ImportMetaRegistry mock and structuredClone polyfill to test-setup.ts
 * - Update tsconfig files to remove jest.resolver.js references
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, config] of projects.entries()) {
    if (!isExpoProject(tree, config.root)) {
      continue;
    }

    // Check if this project has Jest configured
    const jestConfigPath = findJestConfigPath(tree, config.root);
    if (!jestConfigPath) {
      continue;
    }

    const jestConfigContent = tree.read(jestConfigPath, 'utf-8');

    // Only process if this is an Expo project with jest-expo preset and custom resolver
    if (
      !jestConfigContent.includes('jest-expo') ||
      !jestConfigContent.includes('jest.resolver.js')
    ) {
      continue;
    }

    // Remove resolver property from jest.config using AST
    removePropertyFromJestConfig(tree, jestConfigPath, 'resolver');

    // Delete jest.resolver.js file
    const resolverPath = join(config.root, 'jest.resolver.js');
    if (tree.exists(resolverPath)) {
      tree.delete(resolverPath);
    }

    // Update test-setup.ts with new mocks
    updateTestSetup(tree, config.root);

    // Update tsconfig files to remove jest.resolver.js references
    updateTsConfigFilesForV54(tree, config.root);

    logger.info(
      `Updated Jest configuration for ${projectName} to support Expo SDK 54`
    );
  }

  await formatFiles(tree);
}

function findJestConfigPath(tree: Tree, projectRoot: string): string | null {
  const possiblePaths = [
    join(projectRoot, 'jest.config.ts'),
    join(projectRoot, 'jest.config.cts'),
    join(projectRoot, 'jest.config.js'),
  ];

  for (const configPath of possiblePaths) {
    if (tree.exists(configPath)) {
      return configPath;
    }
  }

  return null;
}

function updateTestSetup(tree: Tree, projectRoot: string): void {
  const testSetupTsPath = join(projectRoot, 'src/test-setup.ts');
  const testSetupJsPath = join(projectRoot, 'src/test-setup.js');

  let testSetupPath = testSetupTsPath;
  if (!tree.exists(testSetupTsPath)) {
    if (tree.exists(testSetupJsPath)) {
      testSetupPath = testSetupJsPath;
    } else {
      // Create test-setup.ts if it doesn't exist
      tree.write(testSetupPath, '');
    }
  }

  let existingContent = tree.read(testSetupPath, 'utf-8') || '';

  // Add ImportMetaRegistry mock if not already present
  if (!existingContent.includes('ImportMetaRegistry')) {
    const importMetaRegistryMock = `jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

`;
    existingContent = importMetaRegistryMock + existingContent;
  }

  // Add structuredClone polyfill if not already present
  if (!existingContent.includes('structuredClone')) {
    const structuredClonePolyfill = `if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (object) => JSON.parse(JSON.stringify(object));
}
`;
    existingContent = existingContent + '\n' + structuredClonePolyfill;
  }

  tree.write(testSetupPath, existingContent);
}

function updateTsConfigFilesForV54(tree: Tree, projectRoot: string): void {
  // Update main tsconfig (app or lib) to remove jest.resolver.js from excludes
  const mainTsConfigFiles = [
    'tsconfig.app.json',
    'tsconfig.lib.json',
    'tsconfig.json',
  ];

  for (const configFile of mainTsConfigFiles) {
    const configPath = join(projectRoot, configFile);
    if (tree.exists(configPath)) {
      try {
        updateJson(tree, configPath, (json) => {
          if (json.exclude && Array.isArray(json.exclude)) {
            json.exclude = json.exclude.filter(
              (item: string) => item !== 'jest.resolver.js'
            );
          }
          return json;
        });
      } catch {
        // Skip if JSON is invalid
      }
      break;
    }
  }

  // Update tsconfig.spec.json to remove jest.resolver.js from includes
  const specTsConfigPath = join(projectRoot, 'tsconfig.spec.json');
  if (tree.exists(specTsConfigPath)) {
    try {
      updateJson(tree, specTsConfigPath, (json) => {
        if (json.include && Array.isArray(json.include)) {
          json.include = json.include.filter(
            (item: string) => item !== 'jest.resolver.js'
          );
        }
        return json;
      });
    } catch {
      // Skip if JSON is invalid
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
    return Boolean(
      packageJson.dependencies?.expo || packageJson.devDependencies?.expo
    );
  } catch {
    return false;
  }
}
