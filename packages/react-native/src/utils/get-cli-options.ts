import { names } from '@nrwl/devkit';

export function getCliOptions<T>(
  options: T,
  optionKeysToIgnore: string[] = [],
  optionKeysInCamelName: string[] = []
): string[] {
  return Object.keys(options).reduce((acc, optionKey) => {
    const optionValue = options[optionKey];
    if (!optionKeysToIgnore.includes(optionKey)) {
      const cliKey = names(optionKey).fileName; // cli uses kebab case
      if (optionKeysInCamelName.includes(optionKey)) {
        acc.push(`--${optionKey}`, optionValue);
      } else if (typeof optionValue === 'boolean' && optionValue) {
        // no need to pass in the value when it is true, just the flag name
        acc.push(`--${cliKey}`);
      } else {
        acc.push(`--${cliKey}`, optionValue);
      }
    }
    return acc;
  }, []);
}
