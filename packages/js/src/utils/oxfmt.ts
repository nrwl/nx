import {
  addDependenciesToPackageJson,
  updateJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
// Imported rather than copied: detection ("is this workspace using oxfmt?")
// and setup ("should a config be written?") have to agree on the same list, or
// a workspace that already has a config gets a second, redundant one.
import { oxfmtConfigFiles } from '@nx/devkit/internal';
import { assertNxSupportsFormatters } from './nx-formatter-internals';
import { oxfmtVersion } from './versions';

export function generateOxfmtSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
  assertNxSupportsFormatters();

  if (oxfmtConfigFiles.every((name) => !tree.exists(name))) {
    // oxfmt defaults to double quotes and we prefer single, so that is the one
    // option worth setting. Line width is left at oxfmt's default.
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true });
  }

  // The oxc extension is what drives oxfmt in the editor, so recommend it for
  // the same reason the prettier setup recommends its own. Only when the file
  // is already there - creating it would push an editor choice on a workspace
  // that has not made one.
  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ??= [];
      const extension = 'oxc.oxc-vscode';
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
      return json;
    });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
