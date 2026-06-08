import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getRangeMinimum } from '@nx/js/internal';
import { gte } from 'semver';
import { typescriptVersion } from './versions';

/**
 * Remix has no TypeScript 6-capable release, so Remix generators must keep the
 * workspace on TS 5.x. Reads the DECLARED `typescript` version (not the
 * installed one - a fresh workspace may not have it installed yet) and:
 * - throws a hard, actionable error when the declared range's minimum is
 *   >= 6.0.0 (`<6` and `*` resolve to `0.0.0`, so they pass through);
 * - pins TS to Remix's own `~5.9.2` only when `typescript` is absent, never
 *   overwriting an existing (5.x) pin.
 *
 * Dist-tags (`latest`/`next`) and unparseable ranges have no resolvable floor,
 * so the throw is skipped for them, consistent with devkit's
 * `assertSupportedPackageVersion`.
 *
 * Call at the top of every Remix generator, before any init/mutation.
 */
export function assertAndPinRemixTypescript(tree: Tree): GeneratorCallback {
  const declared = getDependencyVersionFromPackageJson(tree, 'typescript');
  const minimum = declared ? getRangeMinimum(declared) : undefined;
  if (minimum && gte(minimum, '6.0.0')) {
    throw new Error(
      `Remix does not support TypeScript 6 (detected \`typescript@${declared}\`).\n\n` +
        `Keep \`typescript\` on a 5.x version to continue using Remix, or migrate to ` +
        `React Router v7 by generating an application with the @nx/react generator: ` +
        `\`nx g @nx/react:application <name> --routing --useReactRouter\`.`
    );
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { typescript: typescriptVersion },
    undefined,
    true
  );
}
