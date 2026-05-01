import type ChangelogRenderer from '../../../../release/changelog-renderer';
import { registerTsProject } from '../../../plugins/js/utils/register';
import { getRootTsConfigPath } from '../../../plugins/js/utils/typescript';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';

export function resolveChangelogRenderer(
  changelogRendererPathOrImplementation: string | typeof ChangelogRenderer
): typeof ChangelogRenderer {
  // An implementation was provided directly via the programmatic API
  if (typeof changelogRendererPathOrImplementation === 'function') {
    return changelogRendererPathOrImplementation;
  }

  const interpolatedChangelogRendererPath = interpolate(
    changelogRendererPathOrImplementation,
    {
      workspaceRoot,
    }
  );

  // Try and load the provided (or default) changelog renderer
  let ChangelogRendererClass: typeof ChangelogRenderer;
  let cleanupTranspiler = () => {};
  try {
    const rootTsconfigPath = getRootTsConfigPath();
    if (rootTsconfigPath) {
      cleanupTranspiler = registerTsProject(rootTsconfigPath);
    }
    const r = require(interpolatedChangelogRendererPath);
    ChangelogRendererClass = r.default || r;
  } catch (err) {
    throw err;
  } finally {
    cleanupTranspiler();
  }
  return ChangelogRendererClass;
}
