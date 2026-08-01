import { logger } from '@nx/devkit';

// TODO(v24): Remove all Angular Module Federation surfaces from @nx/angular.
// Angular Native Federation (@angular-architects/native-federation) is the
// supported Angular MF path going forward; the new @nx/module-federation
// generators are React-only.
const MIGRATION_URL =
  'https://nx.dev/docs/technologies/module-federation/consumer-and-provider';
const ANGULAR_NATIVE_FED_URL =
  'https://www.npmjs.com/package/@angular-architects/native-federation';

const ANGULAR_MF_TRAILER = `Angular Module Federation in Nx is no longer supported. Use \`@angular-architects/native-federation\` (${ANGULAR_NATIVE_FED_URL}) for the supported Angular path. See ${MIGRATION_URL} for the v23 migration guide.`;

export const ANGULAR_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/angular:module-federation-dev-server\` executor is deprecated and will be removed in Nx v24. ${ANGULAR_MF_TRAILER}`;

export const ANGULAR_MF_DEV_SSR_EXECUTOR_DEPRECATION_MESSAGE = `The \`@nx/angular:module-federation-dev-ssr\` executor is deprecated and will be removed in Nx v24. ${ANGULAR_MF_TRAILER}`;

// Executor warnings fire once per process to avoid flooding dev-server loops.
const executorWarned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (executorWarned.has(key)) return;
  executorWarned.add(key);
  logger.warn(message);
}

export function warnAngularMfDevServerExecutorDeprecation(): void {
  warnOnce(
    'angular-mf-dev-server',
    ANGULAR_MF_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE
  );
}

export function warnAngularMfDevSsrExecutorDeprecation(): void {
  warnOnce(
    'angular-mf-dev-ssr',
    ANGULAR_MF_DEV_SSR_EXECUTOR_DEPRECATION_MESSAGE
  );
}
