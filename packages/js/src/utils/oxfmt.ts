import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
// Imported rather than copied: detection ("is this workspace using oxfmt?")
// and setup ("should a config be written?") have to agree on the same list, or
// a workspace that already has a config gets a second, redundant one.
import { oxfmtConfigFiles } from '@nx/devkit/internal';
import { oxfmtVersion } from './versions';

export function generateOxfmtSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
  if (oxfmtConfigFiles.every((name) => !tree.exists(name))) {
    // oxfmt defaults to double quotes and we prefer single, so that is the one
    // option worth setting. Line width is left at oxfmt's default.
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
