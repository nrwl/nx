import {
  joinPathFragments,
  logger,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { moveBuildLibsFromSourceToViteConfig } from './build-post-target-transformer';

export function servePostTargetTransformer(
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

    if ('buildLibsFromSource' in target.options) {
      moveBuildLibsFromSourceToViteConfig(
        tree,
        target.options.buildLibsFromSource,
        viteConfigPath
      );
      delete target.options.buildLibsFromSource;
    }

    if ('proxyConfig' in target.options) {
      logger.warn(
        `Encountered 'proxyConfig' in project.json when migrating '@nx/vite:dev-server'. You will need to copy the contents of this file to your ${viteConfigPath}.`
      );
      delete target.options.proxyConfig;
    }
  }

  return target;
}
