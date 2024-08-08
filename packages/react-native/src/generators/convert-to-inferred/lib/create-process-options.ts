import { names } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

/**
 * Logic copied from `packages/react-native/src/utils/get-cli-options.ts`,
 * which was used by most executors to map their options to CLI options.
 */
export function createProcessOptions(
  executorName: string,
  optionKeysToIgnore: string[],
  optionKeysInCamelName: string[]
) {
  return (projectName: string, options: any, migrationLogs: AggregatedLog) => {
    const args = [];
    for (const optionKey of Object.keys(options)) {
      const optionValue = options[optionKey];
      delete options[optionKey];

      if (optionKeysToIgnore.includes(optionKey)) {
        migrationLogs.addLog({
          project: projectName,
          executorName,
          log: `Unable to migrate '${optionKey}' to inferred target configuration.`,
        });
        continue;
      }

      const cliKey = optionKeysInCamelName.includes(optionKey)
        ? names(optionKey).propertyName
        : names(optionKey).fileName; // cli uses kebab case as default

      if (Array.isArray(optionValue)) {
        args.push(`--${cliKey}`, optionValue.join(','));
      } else if (typeof optionValue === 'boolean' && optionValue) {
        // no need to pass in the value when it is true, just the flag name
        args.push(`--${cliKey}`);
      } else {
        args.push(`--${cliKey}`, optionValue);
      }
    }
    options.args = args;
  };
}
