import type { TargetConfiguration, Tree } from '@nx/devkit';

export function buildPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  return target;
}
