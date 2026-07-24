import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { oxfmtVersion } from './versions';

const oxfmtConfigFiles = [
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  'oxfmt.config.ts',
  'oxfmt.config.mts',
  'oxfmt.config.cts',
  'oxfmt.config.js',
  'oxfmt.config.mjs',
  'oxfmt.config.cjs',
];

export function generateOxfmtSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
  if (oxfmtConfigFiles.every((name) => !tree.exists(name))) {
    // Matches the style Nx has always generated. oxfmt's own defaults differ
    // from prettier's (printWidth 100 vs 80), so they are set explicitly to
    // keep generated code identical across the two formatters.
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true, printWidth: 80 });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
