import { logger } from '@nx/devkit';
// @ts-ignore
import * as stylusLoader from 'stylus-loader';
// TOOD(v18): Remove this file and stylus support.
export default function (source: string): string {
  logger.warn(
    `Stylus is support is deprecated and will be removed in Nx 18. We recommend that you migrate to Sass by renaming \`.styl\` files to \`.scss\` and ensuring that the content is valid Sass.`
  );
  return stylusLoader.call(this, source);
}
