import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
// Imported rather than copied: detection ("is this workspace using oxfmt?")
// and setup ("should a config be written?") have to agree on the same list, or
// a workspace that already has a config gets a second, redundant one.
import { oxfmtConfigFiles } from 'nx/src/devkit-internals';
import { oxfmtVersion } from './versions';

export function generateOxfmtSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
  // `oxfmtConfigFiles` is new in this nx. `@nx/js` has no `nx` peer of its own, so it
  // inherits devkit's `>= 22 <= 24` and can be paired with an nx that does not
  // export it - where a bare `.every` would be a TypeError inside `@nx/js:init`.
  // Falling back to the canonical name may write a redundant config on such a
  // pairing, which is a better failure than a crash.
  const configFiles = oxfmtConfigFiles ?? ['.oxfmtrc.json'];
  if (configFiles.every((name) => !tree.exists(name))) {
    // Matches the style Nx has always generated. oxfmt's own defaults differ
    // from prettier's (printWidth 100 vs 80), so they are set explicitly to
    // keep generated code identical across the two formatters.
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true, printWidth: 80 });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
