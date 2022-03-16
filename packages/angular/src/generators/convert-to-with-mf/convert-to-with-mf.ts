import { logger, Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import { readProjectConfiguration, formatFiles } from '@nrwl/devkit';
import { getMfeProjects } from '../../utils/get-mfe-projects';
import {
  checkOutputNameMatchesProjectName,
  checkSharedNpmPackagesMatchExpected,
  getWebpackConfigPath,
  isHostRemoteConfig,
  parseASTOfWebpackConfig,
  writeNewWebpackConfig,
} from './lib';

export default async function convertToWithMF(tree: Tree, schema: Schema) {
  const projects = new Set(getMfeProjects(tree));

  if (!projects.has(schema.project)) {
    throw new Error(
      `Could not find project "${schema.project}" with a Micro Frontend configuration in your workspace. Please check the name of the project you're wishing to convert exists.`
    );
  }

  const project = readProjectConfiguration(tree, schema.project);
  const pathToWebpackConfig = getWebpackConfigPath(project, schema.project);
  const webpackAst = parseASTOfWebpackConfig(tree, pathToWebpackConfig);

  if (!checkOutputNameMatchesProjectName(webpackAst, schema.project)) {
    throw new Error(
      `Cannot automatically migrate "${schema.project}" to "withModuleFederation" micro frontend webpack config. 
      "uniqueName" in webpack config (${pathToWebpackConfig}) does not match project name.`
    );
  }

  if (!checkSharedNpmPackagesMatchExpected(webpackAst)) {
    throw new Error(
      `Cannot automatically migrate "${schema.project}" to "withModuleFederation" micro frontend webpack config. 
        There are npm packages being shared with a custom configuration in webpack config (${pathToWebpackConfig}).`
    );
  }

  logger.warn(
    `This Micro Frontend configuration conversion will overwrite "${schema.project}"'s current webpack config. If you have anything custom that is not related to Micro Frontends, it will be lost. You should be able to see the changes in your version control system.`
  );

  const updatedWebpackConfig = writeNewWebpackConfig(
    webpackAst,
    isHostRemoteConfig(webpackAst),
    schema.project
  );
  tree.write(pathToWebpackConfig, updatedWebpackConfig);

  await formatFiles(tree);
}
