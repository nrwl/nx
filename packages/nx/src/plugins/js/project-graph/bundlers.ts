import type { ProjectConfiguration } from '@nx/devkit';
import type { BundlerKind } from './types';

const BUNDLER_EXECUTOR_MATCHERS: Record<BundlerKind, RegExp> = {
  esbuild: /esbuild/i,
  swc: /swc|rspack/i,
  babel: /babel/i,
  webpack: /webpack/i,
  rollup: /rollup/i,
  vite: /vite/i,
};

export function detectBundlersForProject(
  project: ProjectConfiguration | undefined
): BundlerKind[] {
  if (!project?.targets) {
    return [];
  }

  const detected = new Set<BundlerKind>();

  for (const target of Object.values(project.targets)) {
    const executor = (target.executor ?? '').toString();

    for (const [kind, matcher] of Object.entries(BUNDLER_EXECUTOR_MATCHERS)) {
      if (matcher.test(executor)) {
        detected.add(kind as BundlerKind);
      }
    }
  }

  return [...detected];
}
