import { styleText } from 'node:util';
import { logger, Tree } from '@nx/devkit';
import { NormalizedSchema, Schema } from '../schema';

export function showPossibleWarnings(
  tree: Tree,
  options: NormalizedSchema<Schema>
) {
  if (options.style === 'styled-jsx' && options.compiler === 'swc') {
    logger.warn(
      `styled-jsx may not work with SWC. Try using ${styleText(
        'bold',
        'nx g @nx/react:app --compiler=babel'
      )} instead.`
    );
  }
}
