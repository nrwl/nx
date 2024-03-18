import { NextConfigFn } from '../src/utils/config';
import { WithNxOptions } from './with-nx';

// TODO(v19): Remove file, it is here until users migrate over to SASS manually.
export function withStylus(
  configOrFn: WithNxOptions | NextConfigFn
): NextConfigFn {
  return async (phase: string) => {
    throw new Error(
      `Stylus support has been removed and you should use the built-in SASS support. Remove the "withStylus" plugin from your Next.js config, and rename your files from .styl to .scss.`
    );
  };
}

module.exports = withStylus;
module.exports.withStylus = withStylus;
