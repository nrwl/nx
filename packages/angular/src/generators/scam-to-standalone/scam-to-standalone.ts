import type { Tree } from '@nrwl/devkit';
import { formatFiles, getProjects, joinPathFragments } from '@nrwl/devkit';
import type { Schema } from './schema';
import {
  convertScamToStandalone,
  getComponentDataFromAST,
  getModuleMetadataFromAST,
  getTargetProject,
  replaceModuleUsagesWithComponent,
  verifyIsInlineScam,
  verifyModuleIsScam,
} from './lib';

export async function scamToStandalone(
  tree: Tree,
  { component, project: projectName, skipFormat }: Schema
) {
  const projects = getProjects(tree);
  let project = getTargetProject(projectName, projects);

  const normalizedComponentPath = joinPathFragments(project.root, component);
  if (!tree.exists(normalizedComponentPath)) {
    throw new Error(
      `The path provided to the component (${normalizedComponentPath}) does not exist. Please ensure the correct path has been provided.`
    );
  }

  const { componentFileContents, componentAST, componentName } =
    getComponentDataFromAST(tree, normalizedComponentPath);

  const isInlineScam = verifyIsInlineScam(componentAST);

  if (!isInlineScam) {
    throw new Error(
      'This generator currently only supports inline SCAMs. We could not find an accompanying NgModule within the component file, please ensure the SCAM provided is an inline scam.'
    );
  }

  const {
    moduleNodes,
    exportsArray,
    importsArray,
    declarationsArray,
    providersArray,
    moduleName,
  } = getModuleMetadataFromAST(componentAST, componentFileContents);

  verifyModuleIsScam(exportsArray, componentName, declarationsArray);

  convertScamToStandalone(
    componentAST,
    componentFileContents,
    importsArray,
    providersArray,
    moduleNodes,
    tree,
    normalizedComponentPath,
    componentName
  );

  replaceModuleUsagesWithComponent(tree, moduleName, componentName);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

export default scamToStandalone;
