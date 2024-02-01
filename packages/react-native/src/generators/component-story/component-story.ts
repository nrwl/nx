import { Tree, logger } from '@nx/devkit';
import { componentStoryGenerator as reactComponentStoryGenerator } from '@nx/react';
import { CreateComponentStoriesFileSchema } from './schema';

/**
 * @deprecated This would be a direct pass through to @nx/react:component-story generator.
 * TODO (@xiongemi): remove this generator for v19
 */
export async function componentStoryGenerator(
  host: Tree,
  schema: CreateComponentStoriesFileSchema
) {
  logger.warn(
    `Please run 'nx run @nx/react:component-story ${schema.project}' instead.`
  );
  return reactComponentStoryGenerator(host, schema);
}

export default componentStoryGenerator;
