import type ChangelogRenderer from '../../../../release/changelog-renderer';
import {
  loadTsFile,
  requireWithTsconfigFallback,
} from '../../../plugins/js/utils/register';
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

  // TS renderers go through loadTsFile (native-strip -> swc/ts-node + paths).
  // JS renderers use require() with a lazy tsconfig-paths fallback so workspace
  // alias imports still resolve, without paying registration cost up front.
  const r = /\.[cm]?ts$/.test(interpolatedChangelogRendererPath)
    ? loadTsFile<any>(interpolatedChangelogRendererPath)
    : requireWithTsconfigFallback<any>(interpolatedChangelogRendererPath);
  return r.default || r;
}
