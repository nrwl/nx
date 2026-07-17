import { logger } from '@nx/devkit';

// TODO(v24): Remove these surfaces. Replaced by `@nx/react:consumer`
// and `@nx/react:provider` (React, dynamic federation, Vite/Rsbuild/Rspack).
const MIGRATION_URL =
  'https://nx.dev/docs/technologies/module-federation/consumer-and-provider';

export const REACT_HOST_GENERATOR_DEPRECATION_MESSAGE = `The \`@nx/react:host\` generator is deprecated and will be removed in Nx v24. Use \`nx g @nx/react:consumer\` (dynamic federation, no static-serve orchestration). See ${MIGRATION_URL} for the v23 migration guide.`;

export const REACT_REMOTE_GENERATOR_DEPRECATION_MESSAGE = `The \`@nx/react:remote\` generator is deprecated and will be removed in Nx v24. Use \`nx g @nx/react:provider\` instead. See ${MIGRATION_URL} for the v23 migration guide.`;

export const REACT_FEDERATE_MODULE_GENERATOR_DEPRECATION_MESSAGE = `The \`@nx/react:federate-module\` generator is deprecated and will be removed in Nx v24. The new \`@nx/react:provider\` generator exposes modules directly. See ${MIGRATION_URL} for the v23 migration guide.`;

export const REACT_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/react:module-federation-dev-server\` executor is deprecated and will be removed in Nx v24. Dynamic federation in \`@nx/react:consumer\` removes the need for host-orchestrated remote serving. See ${MIGRATION_URL} for the v23 migration guide.`;

export const REACT_MF_SSR_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/react:module-federation-ssr-dev-server\` executor is deprecated and will be removed in Nx v24. SSR is not first-classed in the new generators; see ${MIGRATION_URL} for guidance on wiring SSR with \`@nx/react:consumer\`.`;

export const REACT_MF_STATIC_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/react:module-federation-static-server\` executor is deprecated and will be removed in Nx v24. Use plain \`vite preview\` / \`rsbuild preview\` via \`nx:run-commands\` if a static-serve workflow is still needed. See ${MIGRATION_URL} for details.`;

export function warnReactHostGeneratorDeprecation(): void {
  logger.warn(REACT_HOST_GENERATOR_DEPRECATION_MESSAGE);
}

export function warnReactRemoteGeneratorDeprecation(): void {
  logger.warn(REACT_REMOTE_GENERATOR_DEPRECATION_MESSAGE);
}

export function warnReactFederateModuleGeneratorDeprecation(): void {
  logger.warn(REACT_FEDERATE_MODULE_GENERATOR_DEPRECATION_MESSAGE);
}

// Executor warnings fire once per process (dev-server reload loops would
// otherwise flood the console).
const executorWarned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (executorWarned.has(key)) return;
  executorWarned.add(key);
  logger.warn(message);
}

export function warnReactMfDevServerExecutorDeprecation(): void {
  warnOnce(
    'react-mf-dev-server',
    REACT_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}

export function warnReactMfSsrDevServerExecutorDeprecation(): void {
  warnOnce(
    'react-mf-ssr-dev-server',
    REACT_MF_SSR_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}

export function warnReactMfStaticServerExecutorDeprecation(): void {
  warnOnce(
    'react-mf-static-server',
    REACT_MF_STATIC_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}
