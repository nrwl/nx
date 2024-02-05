import { Tree } from '@nx/devkit';
import { storiesGenerator as reactStoriesGenerator } from '@nx/react';
import { StorybookStoriesSchema } from './schema';

/**
 * @deprecated This would be a direct pass through to @nx/react:stories generator.
 * TODO (@xiongemi): remove this generator for v19
 */
export async function storiesGenerator(
  host: Tree,
  schema: StorybookStoriesSchema
) {
  return reactStoriesGenerator(host, schema);
}

export default storiesGenerator;
