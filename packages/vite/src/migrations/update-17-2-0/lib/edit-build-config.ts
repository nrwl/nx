import {
  ChangeType,
  ProjectConfiguration,
  Tree,
  applyChangesToString,
  joinPathFragments,
  logger,
  offsetFromRoot,
  updateProjectConfiguration,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');

export function updateBuildOutDirAndRoot(
  options: Record<string, any>,
  configContents: string,
  projectConfig: ProjectConfiguration,
  targetName: string,
  tree: Tree,
  projectName: string
): string {
  const foundDefineConfig = tsquery.query(
    configContents,
    'CallExpression:has(Identifier[name="defineConfig"])'
  )?.[0];

  if (!foundDefineConfig) {
    logger.warn(`
    Could not find defineConfig in your vite.config file.
    Please add the build.outDir and root options to your vite.config file.
    `);
  }

  configContents = fixBuild(
    options,
    configContents,
    projectConfig,
    targetName,
    tree,
    projectName,
    foundDefineConfig
  );

  configContents = addRoot(configContents, foundDefineConfig);

  return configContents;
}

function fixBuild(
  options: Record<string, any>,
  configContents: string,
  projectConfig: ProjectConfiguration,
  targetName: string,
  tree: Tree,
  projectName: string,
  foundDefineConfig?: ts.Node
) {
  let outputPath = '';

  // In vite.config.ts, we want to keep the path relative to workspace root
  if (options.outputPath) {
    outputPath = joinPathFragments(
      offsetFromRoot(projectConfig.root),
      options.outputPath
    );
  } else {
    outputPath = joinPathFragments(
      offsetFromRoot(projectConfig.root),
      'dist',
      projectConfig.root
    );
  }

  // In project.json, we want to keep the path starting from workspace root
  projectConfig.targets[targetName].options.outputPath = options.outputPath
    ? options.outputPath
    : joinPathFragments('dist', projectConfig.root);
  updateProjectConfiguration(tree, projectName, projectConfig);

  const buildObject = tsquery.query(
    configContents,
    `PropertyAssignment:has(Identifier[name="build"])`
  )?.[0];

  if (buildObject) {
    const reportCompressedSizeExists =
      tsquery.query(
        buildObject,
        `PropertyAssignment:has(Identifier[name="reportCompressedSize"])`
      )?.length > 0;

    const commonjsOptionsExists =
      tsquery.query(
        buildObject,
        `PropertyAssignment:has(Identifier[name="commonjsOptions"])`
      )?.length > 0;

    const buildOutDir = tsquery.query(
      buildObject,
      `PropertyAssignment:has(Identifier[name="outDir"])`
    )?.length;

    // Array to store changes
    let changes = [];

    // Add outDir if not present
    if (!buildOutDir) {
      changes.push({
        type: ChangeType.Insert,
        index: buildObject.getStart() + `build: {`.length + 1,
        text: `outDir: '${outputPath}',`,
      });
    }

    // Add reportCompressedSize if not present
    if (!reportCompressedSizeExists) {
      changes.push({
        type: ChangeType.Insert,
        index: buildObject.getStart() + `build: {`.length + 1,
        text: `reportCompressedSize: true,`,
      });
    }

    // Add commonjsOptions if not present
    if (!commonjsOptionsExists) {
      changes.push({
        type: ChangeType.Insert,
        index: buildObject.getStart() + `build: {`.length + 1,
        text: `commonjsOptions: { transformMixedEsModules: true },`,
      });
    }

    if (changes.length > 0) {
      return applyChangesToString(configContents, changes);
    }
  } else {
    return addBuildProperty(configContents, outputPath, foundDefineConfig);
  }

  return configContents;
}

function addRoot(
  configFileContents: string,
  foundDefineConfig?: ts.Node
): string {
  const rootOption = tsquery.query(
    configFileContents,
    `PropertyAssignment:has(Identifier[name="root"]) Identifier[name="__dirname"]`
  )?.[0];

  if (rootOption || !foundDefineConfig) {
    return configFileContents;
  } else {
    return applyChangesToString(configFileContents, [
      {
        type: ChangeType.Insert,
        index: foundDefineConfig.getStart() + 14,
        text: `root: __dirname,`,
      },
    ]);
  }
}

function addBuildProperty(
  configFileContents: string,
  outputPath: string,
  foundDefineConfig: ts.Node
): string {
  if (foundDefineConfig) {
    return applyChangesToString(configFileContents, [
      {
        type: ChangeType.Insert,
        index: foundDefineConfig.getStart() + 14,
        text: `build: {
                outDir: '${outputPath}',
                reportCompressedSize: true,
                commonjsOptions: {
                  transformMixedEsModules: true,
                },
              },`,
      },
    ]);
  } else {
    return configFileContents;
  }
}
