import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import {
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { basename, dirname, extname, relative } from 'path';
import { ComponentTestSchema } from './schema';

export function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  assertMinimumCypressVersion(10);

  const projectConfig = readProjectConfiguration(tree, options.project);

  const normalizedPath = options.componentPath.startsWith(
    projectConfig.sourceRoot
  )
    ? relative(projectConfig.sourceRoot, options.componentPath)
    : options.componentPath;

  const componentPath = joinPathFragments(
    projectConfig.sourceRoot,
    normalizedPath
  );
  const componentDir = dirname(componentPath);
  const componentExt = extname(componentPath);
  const n = names(basename(componentPath, componentExt));

  // TODO(caleb): can we get fancy and generate meaningful tests like storybook?
  generateFiles(tree, joinPathFragments(__dirname, 'files'), componentDir, {
    ...n,
    ext: componentExt,
  });
}

export default componentTestGenerator;
