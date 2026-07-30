import type { GeneratorCallback, Tree } from '@nx/devkit';
import type { FormatterType } from 'nx/src/devkit-internals';
import { generateOxfmtSetup } from './oxfmt';
import { generatePrettierSetup } from './prettier';
import { oxfmtVersion, prettierVersion } from './versions';

/**
 * How each formatter is set up, in one place: writing its config file and the
 * version to install. `@nx/js:init` reads both halves - the config now, and the
 * version to make the package resolvable before it formats.
 */
type FormatterSetup<K extends FormatterType = FormatterType> = {
  /**
   * The npm package to install. Tied to the table key by the mapped type
   * below, so the two cannot drift - the alternative is the call site
   * re-deriving one from the other and trusting they match.
   */
  packageName: K;
  setUp: (
    tree: Tree,
    options: { skipPackageJson?: boolean }
  ) => GeneratorCallback;
  version: string;
};

/**
 * Keyed by nx's own `FormatterType` and deliberately *not* `Partial`, so adding
 * a formatter there fails to compile here until it is set up. This is one of
 * the five guarded sites listed on `FormatterType` itself, and the only one
 * outside `packages/nx` - it reads the type from nx's emitted declarations, so
 * it fails only once `packages/nx` has been rebuilt.
 *
 * The guard has to be structural: the repo builds with `strict: false`, so an
 * untyped lookup would silently yield `any` rather than flag a missing member.
 */
const formatterSetups: { [K in FormatterType]: FormatterSetup<K> } = {
  prettier: {
    packageName: 'prettier',
    setUp: generatePrettierSetup,
    version: prettierVersion,
  },
  oxfmt: {
    packageName: 'oxfmt',
    setUp: generateOxfmtSetup,
    version: oxfmtVersion,
  },
};

/**
 * The setup for a formatter name that came from a schema, or `undefined` for
 * `'none'` and anything unrecognised. Callers get a typed result instead of the
 * `any` a bare index would produce under `strict: false`.
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
