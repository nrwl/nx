import type { TargetConfiguration, Tree } from '@nx/devkit';

export function servePostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  return target;
}
