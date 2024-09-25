import { parseNameForAsProvided } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { prompt } from 'enquirer';

export async function ensureLibraryName(options: {
  directory: string;
  name?: string;
  [key: string]: any;
}): Promise<void> {
  if (!options.name) {
    const { name: suggestedName } = parseNameForAsProvided(options.directory);
    const result = await prompt<{ name: string }>({
      type: 'string',
      name: 'name',
      message: 'What do you want to name the library?',
      initial: suggestedName,
    }).then(({ name }) => (options.name = name));
  }
  if (!options.name) {
    const { name: suggestedName } = parseNameForAsProvided(options.directory);
    const result = await prompt<{ name: string }>({
      type: 'string',
      name: 'name',
      message: 'What do you want to name the library?',
      initial: suggestedName,
    }).then(({ name }) => (options.name = name));
  }
}
