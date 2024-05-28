import {
  joinPathFragments,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';

export function testPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
) {
  let viteConfigPath = ['.ts', '.js'].find((ext) =>
    tree.exists(joinPathFragments(projectDetails.root, `vite.config${ext}`))
  );

  if (target.options) {
    if ('configFile' in target.options) {
      target.options.config = target.options.configFile;
      delete target.options.configFile;
    }

    if ('reportsDirectory' in target.options) {
      target.options['coverage.reportsDirectory'] =
        target.options.reportsDirectory;
      delete target.options.reportsDirectory;
    }

    if ('testFiles' in target.options) {
      target.options.testNamePattern = `/(${target.options.testFiles
        .map((f) => f.replace('.', '\\.'))
        .join('|')})/`;
      delete target.options.testFiles;
    }
  }

  return target;
}
