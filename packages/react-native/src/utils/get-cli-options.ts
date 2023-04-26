import { names } from '@nx/devkit';

/**
 * This function normalizes the options passed in to the Nx and returns an array of strings that can be passed to the React Native CLI.
 * @param options Nx options
 * @param optionKeysToIgnore Keys to ignore
 * @param optionKeysInCamelName Keys that are in camel case. Most react native cli options are in kebab case, but some are in camel case.
 * @returns options that can be passed to the React Native CLI
 */
export function getCliOptions<T>(
  options: T,
  optionKeysToIgnore: string[] = [],
  optionKeysInCamelName: string[] = []
): string[] {
  return Object.keys(options).reduce((acc, optionKey) => {
    const optionValue = options[optionKey];
    if (!optionKeysToIgnore.includes(optionKey)) {
      const cliKey = optionKeysInCamelName.includes(optionKey)
        ? names(optionKey).propertyName
        : names(optionKey).fileName; // cli uses kebab case as default
      if (typeof optionValue === 'boolean' && optionValue) {
        // no need to pass in the value when it is true, just the flag name
        acc.push(`--${cliKey}`);
      } else {
        acc.push(`--${cliKey}`, optionValue);
      }
    }
    return acc;
  }, []);
}
