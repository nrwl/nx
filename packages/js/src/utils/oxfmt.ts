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
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
