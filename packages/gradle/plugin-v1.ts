import { emitPluginWorkerLog } from '@nx/devkit/internal';

// TODO(v24): remove `@nx/gradle/plugin-v1` entirely. Users should be migrated
// to `@nx/gradle` (the atomized v2 plugin) via the removal migration shipped
// alongside the deletion.
//
// Use emitPluginWorkerLog so the warning surfaces to the user even when the
// daemon is enabled — `logger.warn` would route to the daemon log file and
// be silently swallowed. Guard against older nx versions (< 22.7) where this
// helper may not exist; @nx/devkit supports nx at +/-1 major.
if (typeof emitPluginWorkerLog === 'function') {
  emitPluginWorkerLog(
    'warn',
    '`@nx/gradle/plugin-v1` is deprecated and will be removed in Nx 24. ' +
      'Switch your `nx.json` plugins entry from `@nx/gradle/plugin-v1` to `@nx/gradle`. ' +
      'Note that the default `@nx/gradle` plugin generates atomized targets — ' +
      'see https://nx.dev/nx-api/gradle for configuration options.'
  );
}

/** @deprecated Use `@nx/gradle` instead. This entry will be removed in Nx 24. */
export { createDependencies } from './src/plugin-v1/dependencies';
/** @deprecated Use `@nx/gradle` instead. This entry will be removed in Nx 24. */
export { createNodes, createNodesV2 } from './src/plugin-v1/nodes';
