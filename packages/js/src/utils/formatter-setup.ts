import type { GeneratorCallback, Tree } from '@nx/devkit';
import { generateOxfmtSetup } from './oxfmt';
import { generatePrettierSetup } from './prettier';
import { oxfmtVersion, prettierVersion } from './versions';

/**
 * How each formatter is set up, in one place: writing its config file and the
 * version to install. `@nx/js:init` reads both halves - the config now, and the
 * version to make the package resolvable before it formats.
 */
type FormatterSetup = {
  setUp: (
    tree: Tree,
    options: { skipPackageJson?: boolean }
  ) => GeneratorCallback;
  version: string;
};

/**
 * Typed as a partial record over the formatters rather than inferred, so an
 * entry left out is a compile error at the lookup instead of a silent
 * "no formatter configured" at runtime.
 */
export const formatterSetups: Partial<
  Record<'prettier' | 'oxfmt', FormatterSetup>
> = {
  prettier: { setUp: generatePrettierSetup, version: prettierVersion },
  oxfmt: { setUp: generateOxfmtSetup, version: oxfmtVersion },
};

/**
 * Writes the chosen formatter's config and queues its install.
 *
 * For callers that only need the formatter configured - a preset that creates
 * an empty workspace, say - rather than the whole of `@nx/js:init`. Does
 * nothing for `'none'` or an unrecognised value.
 */
export function setUpFormatter(
  tree: Tree,
  formatter: string | undefined,
  options: { skipPackageJson?: boolean } = {}
): GeneratorCallback {
  const setup = formatterSetups[formatter as 'prettier' | 'oxfmt'];
  return setup ? setup.setUp(tree, options) : () => {};
}
