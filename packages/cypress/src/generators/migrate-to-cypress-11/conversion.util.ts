import {
  joinPathFragments,
  normalizePath,
  ProjectConfiguration,
  readJson,
  stripIndents,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { basename, dirname, extname, relative } from 'path';
import type { StringLiteral } from 'typescript';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

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
    projectConfig.targets[target]?.options?.cypressConfig;

  // make sure it's a json file, since it could have been updated to ts file from previous configuration migration
  if (!cypressConfigPathJson || extname(cypressConfigPathJson) !== '.json') {
    return {
      cypressConfigPathJson: null,
      cypressConfigPathTs: null,
    };
  }

  const cypressConfigPathTs = joinPathFragments(
    dirname(cypressConfigPathJson),
    // create matching ts config for custom cypress config if present
    cypressConfigPathJson?.endsWith('cypress.json')
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
  const cypressConfigJson = readJson(tree, cypressConfigPathJson);

  const {
    modifyObstructiveCode = null, // no longer needed in configs
    integrationFolder = 'src/e2e', // provide the new defaults if the value isn't present
    supportFile = 'src/support/e2e.ts',
    ...restOfConfig
  } = cypressConfigJson;

  const sourceRoot = getProjectSourceRoot(projectConfig, tree);
  const newIntegrationFolder = tree.exists(
    joinPathFragments(sourceRoot, 'integration')
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
          tree.exists(joinPathFragments(sourceRoot, 'support', 'index.ts'))) ||
        tree.exists(joinPathFragments(sourceRoot, 'support', 'e2e.ts'))
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

  const sourceRoot = getProjectSourceRoot(projectConfig, tree);
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
      sourceRoot,
      'support',
      'index.ts'
    );

    if (tree.exists(defaultSupportFile)) {
      const newSupportDefaultPath = joinPathFragments(
        sourceRoot,
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
      sourceRoot
    );
    oldImportLeafPath = newImportPaths.oldImportPathLeaf;
    newImportLeafPath = newImportPaths.newImportPathLeaf;
  }

  // tree.rename doesn't work on directories must update each file within
  // the directory to the new directory
  visitNotIgnoredFiles(tree, sourceRoot, (path) => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath.includes(oldIntegrationFolder)) {
      return;
    }
    const fileName = basename(normalizedPath);
    let newPath = normalizedPath.replace(
      oldIntegrationFolder,
      newIntegrationFolder
    );

    if (fileName.includes('.spec.')) {
      newPath = newPath.replace('.spec.', '.cy.');
    }
    if (newPath !== normalizedPath && tree.exists(normalizedPath)) {
      tree.rename(normalizedPath, newPath);
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  if (!tsquery) {
    ensureTypescript();
    tsquery = require('@phenomnomnominal/tsquery').tsquery;
  }
  const { isCallExpression, isExportDeclaration, isImportDeclaration } =
    tsModule;
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
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
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

export function updatePluginFile(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  cypressConfigs: {
    cypressConfigTs: Record<string, any>;
    cypressConfigJson: Record<string, any>;
  }
) {
  // if ts file change module.exports = to export default
  // if js file don't do anything
  // update cypressConfigTs.e2e to remove file extension
  const pluginsFile = cypressConfigs.cypressConfigTs?.e2e?.pluginsFile;
  if (!pluginsFile) {
    return cypressConfigs;
  }
  const ext = extname(pluginsFile);
  const updatedCypressConfigs = {
    ...cypressConfigs,
    cypressConfigTs: {
      e2e: {
        ...cypressConfigs.cypressConfigTs.e2e,
        pluginsFile: pluginsFile.replace(ext, ''),
      },
    },
  };

  const pluginFilePath = joinPathFragments(projectConfig.root, pluginsFile);

  if (ext === '.ts' && tree.exists(pluginFilePath)) {
    const pluginFileContent = tree.read(pluginFilePath, 'utf-8');

    tree.write(
      pluginFilePath,
      pluginFileContent
        .replace('module.exports =', 'export default')
        .replace(/module\.exports\.(.*?)=/g, 'export const $1=')
    );
  }

  return updatedCypressConfigs;
}
