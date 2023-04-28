import { logger, Tree } from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';

export function showPossibleWarnings(tree: Tree, options: NormalizedSchema) {
  if (options.style === '@emotion/styled' && options.appDir) {
    logger.warn(
      `Emotion may not work with the experimental appDir layout. See: https://beta.nextjs.org/docs/styling/css-in-js`
    );
  }
}
