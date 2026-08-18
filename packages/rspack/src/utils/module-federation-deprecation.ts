import { logger } from '@nx/devkit';

// TODO(v24): Remove these MF executors. Dynamic federation in the new
// `@nx/react:consumer` generator removes the orchestration need.
const MIGRATION_URL =
  'https://nx.dev/docs/technologies/module-federation/consumer-and-provider';

export const RSPACK_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/rspack:module-federation-dev-server\` executor is deprecated and will be removed in Nx v24. Dynamic federation in \`@nx/react:consumer\` removes the need for host-orchestrated remote serving. See ${MIGRATION_URL} for the v23 migration guide.`;

export const RSPACK_MF_SSR_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/rspack:module-federation-ssr-dev-server\` executor is deprecated and will be removed in Nx v24. SSR is not first-classed in the new generators; see ${MIGRATION_URL} for guidance on wiring SSR with \`@nx/react:consumer\`.`;

export const RSPACK_MF_STATIC_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/rspack:module-federation-static-server\` executor is deprecated and will be removed in Nx v24. Use plain \`rsbuild preview\` / \`sirv-cli\` via \`nx:run-commands\` if a static-serve workflow is still needed. See ${MIGRATION_URL} for details.`;

// Executor warnings fire once per process to avoid flooding dev-server loops.
const executorWarned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (executorWarned.has(key)) return;
  executorWarned.add(key);
  logger.warn(message);
}

export function warnRspackMfDevServerExecutorDeprecation(): void {
  warnOnce(
    'rspack-mf-dev-server',
    RSPACK_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}

export function warnRspackMfSsrDevServerExecutorDeprecation(): void {
  warnOnce(
    'rspack-mf-ssr-dev-server',
    RSPACK_MF_SSR_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}

export function warnRspackMfStaticServerExecutorDeprecation(): void {
  warnOnce(
    'rspack-mf-static-server',
    RSPACK_MF_STATIC_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}
