import {
  joinPathFragments,
  ProjectConfiguration,
  readJson,
  stripIndents,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { basename, dirname, extname, relative } from 'path';
import {
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  StringLiteral,
} from 'typescript';

const validFilesEndingsToUpdate = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
];

export function findCypressConfigs(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  target: string,
  config: string
): {
  cypressConfigPathJson: string;
  cypressConfigPathTs: string;
} {
  const cypressConfigPathJson =
    projectConfig.targets[target]?.configurations?.[config]?.cypressConfig ||
    // make sure it's a json file, since it could have been updated to ts file from previous configuration migration
    (projectConfig.targets[target]?.options?.cypressConfig.endsWith('json')
      ? projectConfig.targets[target]?.options?.cypressConfig
      : joinPathFragments(projectConfig.root, 'cypress.json'));

  const cypressConfigPathTs = joinPathFragments(
    projectConfig.root,
    // create matching ts config for custom cypress config if present
    cypressConfigPathJson.endsWith('cypress.json')
      ? 'cypress.config.ts' //default
      : `${basename(
          cypressConfigPathJson,
          extname(cypressConfigPathJson)
        )}.config.ts`
  );

  return {
    cypressConfigPathJson,
    cypressConfigPathTs,
  };
}

/**
 * update the existing cypress.json config to the new cypress.config.ts structure.
 * return both the old and new configs
 */
export function createNewCypressConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  cypressConfigPathJson: string
): {
  cypressConfigTs: Record<string, any>;
  cypressConfigJson: Record<string, any>;
} {
  console.log({ cypressConfigPathJson });
  const cypressConfigJson = readJson(tree, cypressConfigPathJson);

  const {
    modifyObstructiveCode = null, // no longer needed in configs
    integrationFolder = 'src/e2e', // provide the new defaults if the value isn't present
    supportFile = 'src/support/e2e.ts',
    ...restOfConfig
  } = cypressConfigJson;

  const newIntegrationFolder = tree.exists(
    joinPathFragments(projectConfig.sourceRoot, 'integration')
  )
    ? 'src/e2e'
    : integrationFolder;
  const cypressConfigTs = {
    e2e: {
      ...restOfConfig,
      specPattern: `${newIntegrationFolder}/**/*.cy.{js,jsx,ts,tsx}`,
      // if supportFile is defined (can be false if not using it) and in the default location (or in the new default location),
      // then use the new default location.
      // otherwise we will use the existing folder location/falsey value
      supportFile:
        (supportFile &&
          tree.exists(
            joinPathFragments(projectConfig.sourceRoot, 'support', 'index.ts')
          )) ||
        tree.exists(
          joinPathFragments(projectConfig.sourceRoot, 'support', 'e2e.ts')
        )
          ? 'src/support/e2e.ts'
          : supportFile,
      // if the default location is used then will update to the new location otherwise keep the custom location
      // this is used down the line, but won't be in the final config file since it's a deprecated option
      integrationFolder: newIntegrationFolder,
    },
  };

  return { cypressConfigTs, cypressConfigJson };
}

export function createSupportFileImport(
  oldSupportFilePath: string,
  newSupportFilePath: string,
  projectSourceRoot: string
): { oldImportPathLeaf: string; newImportPathLeaf: string } {
  // need to get the new import path for the support file.
  // before it was "<relative path>/support/index.ts" and the new path will be "<relative path>/support/e2e.ts"
  // i.e. take ../support => ../support/e2e.ts
  // 1. take apps/app-e2e/support/index.ts => support (this cant have a / in it. must grab the leaf for tsquery)
  // 2. if the leaf value is index.ts then grab the parent directory (i.e. so we have support/index.ts => support)
  // 3. take apps/app-e2e/support/e2e.ts => support/e2e

  // apps/app-e2e/support/e2e.ts => support/e2e
  const newFileExt = extname(newSupportFilePath);
  const newImportPathLeaf = relative(
    projectSourceRoot,
    newSupportFilePath
  ).replace(newFileExt, '');

  // apps/app-e2e/support/index.ts => support/index
  const oldFileExt = extname(oldSupportFilePath);
  const oldImportPathLeaf = relative(
    projectSourceRoot,
    oldSupportFilePath
  ).replace(oldFileExt, '');

  // support/index => support
  const oldRelativeImportPath = basename(oldImportPathLeaf, oldFileExt);

  return {
    newImportPathLeaf,
    // don't import from 'support/index' it's just 'support'
    oldImportPathLeaf:
      oldRelativeImportPath === 'index'
        ? dirname(oldImportPathLeaf)
        : oldImportPathLeaf,
  };
}

export function updateProjectPaths(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  {
    cypressConfigTs,
    cypressConfigJson,
  }: {
    cypressConfigTs: Record<string, any>;
    cypressConfigJson: Record<string, any>;
  }
) {
  const { integrationFolder, supportFile } = cypressConfigTs['e2e'];

  const oldIntegrationFolder = joinPathFragments(
    projectConfig.root,
    cypressConfigJson.integrationFolder
  );
  const newIntegrationFolder = joinPathFragments(
    projectConfig.root,
    integrationFolder
  );

  let newSupportFile: string;
  let oldSupportFile: string;
  let oldImportLeafPath: string;
  let newImportLeafPath: string;
  let shouldUpdateSupportFileImports = false;
  // supportFile can be falsey or a string path to the file
  if (cypressConfigJson.supportFile) {
    // we need to check the test files to see if
    // support file import is used and then update it if so
    shouldUpdateSupportFileImports = true;
    oldSupportFile = joinPathFragments(
      projectConfig.root,
      cypressConfigJson.supportFile
    );

    newSupportFile = joinPathFragments(projectConfig.root, supportFile);
    // oldSupportFile might have already been updated
    // to the new default location so must be guarded for
    if (oldSupportFile !== newSupportFile && tree.exists(oldSupportFile)) {
      tree.rename(oldSupportFile, newSupportFile);
    }
  } else {
    shouldUpdateSupportFileImports = false;
    newSupportFile = supportFile;
    // rename the default support file even if not in use to keep the system in sync with cypress v10
    const defaultSupportFile = joinPathFragments(
      projectConfig.sourceRoot,
      'support',
      'index.ts'
    );

    if (tree.exists(defaultSupportFile)) {
      const newSupportDefaultPath = joinPathFragments(
        projectConfig.sourceRoot,
        'support',
        'e2e.ts'
      );
      if (
        defaultSupportFile !== newSupportDefaultPath &&
        tree.exists(defaultSupportFile)
      ) {
        tree.rename(defaultSupportFile, newSupportDefaultPath);
      }
    }
  }

  if (shouldUpdateSupportFileImports) {
    const newImportPaths = createSupportFileImport(
      oldSupportFile,
      newSupportFile,
      projectConfig.sourceRoot
    );
    oldImportLeafPath = newImportPaths.oldImportPathLeaf;
    newImportLeafPath = newImportPaths.newImportPathLeaf;
  }

  // tree.rename doesn't work on directories must update each file within
  // the directory to the new directory
  visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (path) => {
    if (!path.includes(oldIntegrationFolder)) {
      return;
    }
    const fileName = basename(path);
    let newPath = path.replace(oldIntegrationFolder, newIntegrationFolder);

    if (fileName.includes('.spec.')) {
      newPath = newPath.replace('.spec.', '.cy.');
    }
    if (newPath !== path && tree.exists(path)) {
      tree.rename(path, newPath);
    }
    // if they weren't using the supportFile then there is no need to update the imports.
    if (
      shouldUpdateSupportFileImports &&
      validFilesEndingsToUpdate.some((e) => path.endsWith(e))
    ) {
      updateImports(tree, newPath, oldImportLeafPath, newImportLeafPath);
    }
  });

  if (tree.children(oldIntegrationFolder).length === 0) {
    tree.delete(oldIntegrationFolder);
  }
}

export function updateImports(
  tree: Tree,
  filePath: string,
  oldImportPath: string,
  newImportPath: string
) {
  const endOfImportSelector = `StringLiteral[value=/${oldImportPath}$/]`;
  const fileContent = tree.read(filePath, 'utf-8');
  const newContent = tsquery.replace(
    fileContent,
    endOfImportSelector,
    (node: StringLiteral) => {
      // if node.parent is an CallExpression require() ||ImportDeclaration
      if (
        node?.parent &&
        (isCallExpression(node.parent) ||
          isImportDeclaration(node.parent) ||
          isExportDeclaration(node.parent))
      ) {
        return `'${node.text.replace(oldImportPath, newImportPath)}'`;
      }
      return node.text;
    }
  );
  tree.write(filePath, newContent);
}

export function writeNewConfig(
  tree: Tree,
  cypressConfigPathTs: string,
  cypressConfigs: {
    cypressConfigTs: Record<string, any>;
    cypressConfigJson: Record<string, any>;
  }
) {
  // remove deprecated configs options
  const {
    pluginsFile = false,
    integrationFolder = '',
    ...restOfConfig
  } = cypressConfigs.cypressConfigTs.e2e;
  const pluginImport = pluginsFile
    ? `import setupNodeEvents from '${pluginsFile}';`
    : '';

  const convertedConfig = JSON.stringify(restOfConfig, null, 2);

  tree.write(
    cypressConfigPathTs,
    stripIndents`
import { defineConfig } from 'cypress'
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';
${pluginImport}

const cypressJsonConfig = ${convertedConfig}
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    ...cypressJsonConfig,
    ${pluginsFile ? 'setupNodeEvents' : ''}
  }
})
`
  );
}

export function addConfigToTsConfig(
  tree: Tree,
  tsconfigPath: string,
  cypressConfigPath: string
) {
  if (tree.exists(tsconfigPath)) {
    updateJson(
      tree,
      tsconfigPath,
      (json) => {
        json.include = Array.from(
          new Set([
            ...(json.include || []),
            relative(dirname(tsconfigPath), cypressConfigPath),
          ])
        );
        return json;
      },
      { expectComments: true }
    );
  }
}
