import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
  logger,
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
  // `oxfmtConfigFiles` is new in this nx. `@nx/js` has no `nx` peer of its own,
  // so it inherits devkit's `nx` peer range and can be paired with an nx that
  // does not export it. The fallback repeats the *whole* list rather than the
  // canonical name: a one-name fallback would miss an existing config under any
  // other name and write a second one, which for oxfmt is not redundant but
  // fatal ("Both '<a>' and '<b>' found").
  const configFiles = oxfmtConfigFiles ?? [
    '.oxfmtrc.json',
    '.oxfmtrc.jsonc',
    'oxfmt.config.ts',
    'oxfmt.config.mts',
  ];
  if (!oxfmtConfigFiles) {
    logger.warn(
      `This @nx/js is paired with an nx that does not export \`oxfmtConfigFiles\`; using a built-in list. Align the nx and @nx/js versions if a duplicate oxfmt config appears.`
    );
  }
  if (configFiles.every((name) => !tree.exists(name))) {
    // oxfmt defaults to double quotes and we prefer single, so that is the one
    // option worth setting. Line width is left at oxfmt's default.
    writeJson(tree, '.oxfmtrc.json', { singleQuote: true });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { oxfmt: oxfmtVersion });
}
