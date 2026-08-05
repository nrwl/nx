import {
  joinPathFragments,
  logger,
  offsetFromRoot,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { OXLINT_CONFIG_FILENAMES } from './config-file.js';

/**
 * Root configs a generated `extends` can point at — Oxlint only extends JSON.
 * Extendable is not the same as rewritable: for a root project this list is also
 * the rewrite target, and the `.json` check below still refuses `.jsonc`.
 * To ask whether a config exists at all, use `OXLINT_CONFIG_FILENAMES`.
 */
const EXTENDABLE_CONFIG_FILENAMES = OXLINT_CONFIG_FILENAMES.filter((file) =>
  /\.jsonc?$/.test(file)
);

interface OxlintConfig {
  extends?: string[];
  plugins?: string[];
}

export function findRootOxlintConfig(tree: Tree): string | null {
  return EXTENDABLE_CONFIG_FILENAMES.find((file) => tree.exists(file)) ?? null;
}

/**
 * Enables Oxlint plugins for a single project, in that project's own config.
 *
 * A nested config *replaces* the root one for its subtree rather than merging
 * into it, so the generated config extends the root explicitly. Without that
 * `extends`, the root's `categories` and `rules` silently stop applying.
 *
 * Warns and returns when the governing config is one this package cannot rewrite
 * (`.jsonc`, or a TypeScript config) — writing a second config beside it would
 * make Oxlint refuse to lint the project at all.
 */
export function addPluginsToOxlintConfig(
  tree: Tree,
  projectRoot: string,
  plugins: string[]
): void {
  if (!plugins.length) {
    return;
  }

  // Probe every filename Oxlint honours, not just the editable ones: two configs
  // in one directory is a hard error in Oxlint, not an override, so a config we
  // cannot edit still has to stop us writing `.oxlintrc.json` beside it.
  const existingProjectConfig =
    projectRoot === '.'
      ? undefined
      : OXLINT_CONFIG_FILENAMES.map((file) =>
          joinPathFragments(projectRoot, file)
        ).find((path) => tree.exists(path));

  // The root's format only constrains us when a project config has to be
  // created, since that is what needs an `extends` pointing at the root. A
  // project that already has its own editable config can be updated whatever
  // the root is. A root project is its own config, so it always needs one.
  const rootConfigPath = findRootOxlintConfig(tree);
  if (!rootConfigPath && !existingProjectConfig) {
    // A TypeScript config cannot be rewritten statically. Say so — otherwise
    // the generator reports success and the plugins silently never run.
    logger.warn(
      `Could not enable the Oxlint plugin(s) ${plugins.join(
        ', '
      )} for "${projectRoot}": only JSON Oxlint configs can be updated automatically. ` +
        `Add them to the "plugins" array of your Oxlint config manually.`
    );
    return;
  }

  const projectConfigPath =
    projectRoot === '.'
      ? rootConfigPath
      : (existingProjectConfig ??
        joinPathFragments(projectRoot, '.oxlintrc.json'));

  // Only plain JSON survives a rewrite: `updateJson` would strip a `.jsonc`'s
  // comments, and cannot parse a TypeScript config at all. Warn rather than fall
  // through to `writeJson`, which would create the second config Oxlint rejects.
  if (!projectConfigPath.endsWith('.json')) {
    const reason = projectConfigPath.endsWith('.jsonc')
      ? `rewriting ${projectConfigPath} would strip its comments`
      : `${projectConfigPath} is not JSON and cannot be updated automatically`;
    logger.warn(
      `Could not enable the Oxlint plugin(s) ${plugins.join(
        ', '
      )} for "${projectRoot}": ${reason}. ` +
        `Add them to its "plugins" array manually.`
    );
    return;
  }

  if (tree.exists(projectConfigPath)) {
    updateJson<OxlintConfig>(tree, projectConfigPath, (json) => {
      json.plugins = union(json.plugins ?? [], plugins);
      // Deliberately not adding one: an existing config without `extends` may
      // be isolating from the root on purpose. Narrow on purpose too — an
      // `extends` pointing somewhere other than the root, or a TypeScript root
      // (which nothing can extend), are also isolated but have no fix to offer.
      if (rootConfigPath && !json.extends?.length && projectRoot !== '.') {
        logger.warn(
          `"${projectRoot}" has an Oxlint config with no "extends", so ${rootConfigPath}'s ` +
            `categories and rules do not apply to it. The plugin(s) ${plugins.join(
              ', '
            )} still run, but under Oxlint's defaults — so this project can pass lint on ` +
            `violations the root would fail it for. Add "extends": ["${joinPathFragments(
              offsetFromRoot(projectRoot),
              rootConfigPath
            )}"] if that is not intended.`
        );
      }
      return json;
    });
    return;
  }

  writeJson<OxlintConfig>(tree, projectConfigPath, {
    extends: [joinPathFragments(offsetFromRoot(projectRoot), rootConfigPath)],
    plugins: [...plugins],
  });
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}
