import {
  joinPathFragments,
  logger,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';

export function previewPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
) {
  let viteConfigPath = ['.ts', '.js'].find((ext) =>
    tree.exists(joinPathFragments(projectDetails.root, `vite.config${ext}`))
  );

  if (target.options) {
    if ('buildTarget' in target.options) {
      delete target.options.buildTarget;
    }

    if ('staticFilePath' in target.options) {
      delete target.options.staticFilePath;
    }

    if ('proxyConfig' in target.options) {
      logger.warn(
        `Encountered 'proxyConfig' in project.json when migrating '@nx/vite:preview-server'. You will need to copy the contents of this file to your ${viteConfigPath}.`
      );
      delete target.options.proxyConfig;
    }
  }

  return target;
}
