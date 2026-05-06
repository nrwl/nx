import type ChangelogRenderer from '../../../../release/changelog-renderer';
import { loadTsFile } from '../../../plugins/js/utils/register';
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

  const rootTsconfigPath = getRootTsConfigPath();
  const r = rootTsconfigPath
    ? loadTsFile<any>(interpolatedChangelogRendererPath, rootTsconfigPath)
    : require(interpolatedChangelogRendererPath);
  return r.default || r;
}
