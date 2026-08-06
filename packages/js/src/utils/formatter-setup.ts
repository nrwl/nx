import type { GeneratorCallback, Tree } from '@nx/devkit';
import type { FormatterType } from '@nx/devkit/internal';
import { generateOxfmtSetup } from './oxfmt';
import { generatePrettierSetup } from './prettier';
import { oxfmtVersion, prettierVersion } from './versions';

type FormatterSetup = {
  setUp: (
    tree: Tree,
    options: { skipPackageJson?: boolean }
  ) => GeneratorCallback;
  version: string;
};

/**
 * Keyed by nx's own `FormatterType` and deliberately not `Partial`, so adding a
 * formatter there fails to compile here until it is set up. This is one of the
 * five guarded sites listed on `FormatterType` itself, and the only one outside
 * `packages/nx` - it reads the type from nx's emitted declarations, so it fails
 * only once `packages/nx` has been rebuilt.
 *
 * The guard has to be structural: the repo builds with `strict: false`, so an
 * untyped lookup would silently yield `any` rather than flag a missing member.
 *
 * The key doubles as the npm package name; callers install by it.
 */
const formatterSetups: Record<FormatterType, FormatterSetup> = {
  prettier: { setUp: generatePrettierSetup, version: prettierVersion },
  oxfmt: { setUp: generateOxfmtSetup, version: oxfmtVersion },
};

/**
 * The setup for a formatter name that came from a schema, or `undefined` for
 * `'none'` and anything unrecognised.
 *
 * `hasOwnProperty` rather than `in`, which would answer `true` for inherited
 * members like `'constructor'` and hand back an `Object.prototype` function.
 */
export function getFormatterSetup(
  formatter: string | undefined
): FormatterSetup | undefined {
  return formatter !== undefined &&
    Object.prototype.hasOwnProperty.call(formatterSetups, formatter)
    ? formatterSetups[formatter as FormatterType]
    : undefined;
}

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
  const setup = getFormatterSetup(formatter);
  return setup ? setup.setUp(tree, options) : () => {};
}
