import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getRangeMinimum, isTypescriptVersionAtLeast } from '@nx/js/internal';
import { typescriptVersion } from './versions';

/**
 * Remix has no TypeScript 6-capable release, so Remix generators must keep the
 * workspace on TS 5.x. It keys off the DECLARED `typescript` version, consulting
 * the installed version only when it satisfies that declared range, and:
 * - throws a hard, actionable error when the workspace resolves to TS >= 6 (the
 *   declared floor is >= 6, or an open range like `>=5.9.0` is satisfied by an
 *   installed >= 6);
 * - pins TS to Remix's own `~5.9.2` only when `typescript` is absent, never
 *   overwriting an existing (5.x) pin. A typescript present only transitively
 *   (hoisted, no direct declaration) is treated as absent and gets the pin.
 *
 * Dist-tags (`latest`/`next`) and unparseable ranges have no resolvable floor,
 * so the throw is skipped for them, consistent with devkit's
 * `assertSupportedPackageVersion`.
 *
 * Call before any dependency install in Remix generators that install deps;
 * generators that delegate to the init generator (e.g. application) inherit
 * the guard from it.
 */
export function assertAndPinRemixTypescript(tree: Tree): GeneratorCallback {
  const declared = getDependencyVersionFromPackageJson(tree, 'typescript');
  const minimum = declared ? getRangeMinimum(declared) : undefined;
  if (minimum && isTypescriptVersionAtLeast(tree, '6.0.0')) {
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
