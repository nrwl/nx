import { readProjectConfiguration, type Tree } from '@nx/devkit';
import { dirname, join, relative } from 'node:path/posix';

export function getArtifactMetadataDirectory(
  tree: Tree,
  projectName: string,
  sourceDirectory: string,
  isTsSolutionSetup: boolean
): string {
  const project = readProjectConfiguration(tree, projectName);

  if (!isTsSolutionSetup) {
    return `./${relative(project.root, sourceDirectory)}`;
  }

  const target = Object.values(project.targets ?? {}).find(
    (t) => t.executor === '@nx/js:tsc' || t.executor === '@nx/js:swc'
  );

  // the repo is using the new ts setup where the outputs are contained inside the project
  if (target?.executor === '@nx/js:tsc') {
    // the @nx/js:tsc executor defaults rootDir to the project root
    return `./${join(
      'dist',
      relative(target.options.rootDir ?? project.root, sourceDirectory)
    )}`;
  }

  if (target?.executor === '@nx/js:swc') {
    return `./${join(
      'dist',
      target.options.stripLeadingPaths
        ? relative(dirname(target.options.main), sourceDirectory)
        : relative(project.root, sourceDirectory)
    )}`;
  }

  // We generate the plugin with the executors above, so we shouldn't get here
  // unless the user manually changed the build process. In that case, we can't
  // reliably determine the output directory because it depends on the build
  // tool, so we'll just assume some defaults.
  const baseDir =
    project.sourceRoot ??
    (tree.exists(join(project.root, 'src'))
      ? join(project.root, 'src')
      : project.root);

  return `./${join('dist', relative(baseDir, sourceDirectory))}`;
}
