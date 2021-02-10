import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import {
  parseForESLint as tsESLintParser,
  ParserOptions,
} from '@typescript-eslint/parser';

/**
 * Having this extra wrapper allows us to normalize the behavior across
 * different IDE ESLint extensions without users having to manually
 * configure things themselves.
 */
export function parseForESLint(
  code: string,
  options?: ParserOptions
): ReturnType<typeof tsESLintParser> {
  // Only override tsconfigRootDir if the user hasn't already customized it
  if (options && !options.tsconfigRootDir) {
    options.tsconfigRootDir = appRootPath;
  }
  return tsESLintParser(code, options);
}
