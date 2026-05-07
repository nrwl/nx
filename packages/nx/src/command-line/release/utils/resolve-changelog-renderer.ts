import type ChangelogRenderer from '../../../../release/changelog-renderer';
import { loadTsFile } from '../../../plugins/js/utils/register';
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

  const r = loadTsFile<any>(interpolatedChangelogRendererPath);
  return r.default || r;
}
