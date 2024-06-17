// TODO: remove this ignore once we move to a more modern moduleResolution in TS
// @ts-ignore
import { tsImport } from 'tsx/esm/api';

import type { ChangelogRenderer } from '../../../../release/changelog-renderer';
import { getRootTsConfigPath } from '../../../plugins/js/utils/typescript';
import { interpolate } from '../../../tasks-runner/utils';
import { workspaceRoot } from '../../../utils/workspace-root';

export async function resolveChangelogRenderer(
  changelogRendererPath: string
): Promise<ChangelogRenderer> {
  let interpolatedChangelogRendererPath = changelogRendererPath;
  try {
    interpolatedChangelogRendererPath = interpolate(changelogRendererPath, {
      workspaceRoot,
    });

    const rootTsconfigPath = getRootTsConfigPath();
    const loaded = await tsImport(interpolatedChangelogRendererPath, {
      parentURL: __filename,
      tsconfig: rootTsconfigPath ?? false,
    });

    // In the common case `export default` or `module.exports` should come through under the `default` key
    if (typeof loaded.default === 'function') {
      return loaded.default as ChangelogRenderer;
    }

    // In some cases, certain build outputs may set the __esModule flag to true, and the `export default` may be nested
    if (
      loaded.__esModule &&
      loaded.default &&
      typeof loaded.default.default === 'function'
    ) {
      return loaded.default.default as ChangelogRenderer;
    }

    throw new Error(
      `Unexpected tsx result format: ${JSON.stringify({
        loaded,
      })}`
    );
  } catch (err) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(err);
    }
    // Re-throw consistent error message
    throw new Error(`Could not load changelog renderer at: ${interpolatedChangelogRendererPath}

Please ensure that your "renderer" config is set to a valid JavaScript (.js/.mjs/.cjs) or TypeScript (.ts/.mts/.cts) file with an applicable function as its module.exports/default export`);
  }
}
