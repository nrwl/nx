import type ChangelogRenderer from '../../../../release/changelog-renderer';
import { registerTsProject } from '../../../plugins/js/utils/register';
import { getRootTsConfigPath } from '../../../plugins/js/utils/typescript';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';

export function resolveChangelogRenderer(
  changelogRendererPath: string
): typeof ChangelogRenderer {
  const interpolatedChangelogRendererPath = interpolate(changelogRendererPath, {
    workspaceRoot,
  });

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
