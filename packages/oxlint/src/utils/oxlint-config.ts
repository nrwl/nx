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
 * The root config a root project rewrites in place — though the `.json` check
 * below still refuses `.jsonc`. Not where generated `extends` targets come from:
 * those come from the ancestor walk, narrowed by the `.jsonc?` test in
 * `addPluginsToOxlintConfig` rather than by this list.
 */
const EXTENDABLE_CONFIG_FILENAMES = OXLINT_CONFIG_FILENAMES.filter((file) =>
  /\.jsonc?$/.test(file)
);

interface OxlintConfig {
  extends?: string[];
  plugins?: string[];
}

function findRootOxlintConfig(tree: Tree): string | null {
  return EXTENDABLE_CONFIG_FILENAMES.find((file) => tree.exists(file)) ?? null;
}

/**
 * Nearest config above `projectRoot` — the one Oxlint resolves to, and so the
 * only correct `extends` target. Probes every filename, not just the extendable
 * ones: walking past a TypeScript ancestor to reach the root would point the
 * `extends` at a config that is not the one being replaced.
 */
function findNearestOxlintConfig(
  tree: Tree,
  projectRoot: string
): string | null {
  let dir = projectRoot;
  while (dir !== '.') {
    dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '.';
    const found = OXLINT_CONFIG_FILENAMES.map((file) =>
      joinPathFragments(dir, file)
    ).find((path) => tree.exists(path));
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Enables Oxlint plugins for a single project, in that project's own config.
 *
 * A nested config *replaces* the one above it rather than merging into it, so
 * the generated config extends its nearest ancestor explicitly. Without that
 * `extends`, that config's `categories` and `rules` silently stop applying.
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

  // The governing config's format only constrains us when a project config has
  // to be created, since that is what needs an `extends` pointing at it. A
  // project that already has its own editable config can be updated whatever
  // sits above it. A root project is its own config, so it always needs one.
  const nearestConfigPath =
    projectRoot === '.'
      ? findRootOxlintConfig(tree)
      : findNearestOxlintConfig(tree, projectRoot);
  // A TypeScript ancestor governs the project but cannot be extended, so it is
  // no more usable as a target than having no config at all.
  const governingConfigPath =
    nearestConfigPath && /\.jsonc?$/.test(nearestConfigPath)
      ? nearestConfigPath
      : null;
  if (!governingConfigPath && !existingProjectConfig) {
    // A TypeScript config cannot be rewritten statically. Say so — otherwise
    // the generator reports success and the plugins silently never run. Name the
    // file too: it can be an ancestor several levels up, so "your Oxlint config"
    // sends the user looking in the project directory, where there is nothing.
    logger.warn(
      `Could not enable the Oxlint plugin(s) ${plugins.join(
        ', '
      )} for "${projectRoot}": only JSON Oxlint configs can be updated automatically. ` +
        `Add them to the "plugins" array of ${
          nearestConfigPath ? `"${nearestConfigPath}"` : 'your Oxlint config'
        } manually.`
    );
    return;
  }

  const projectConfigPath =
    projectRoot === '.'
      ? governingConfigPath
      : (existingProjectConfig ??
        joinPathFragments(projectRoot, '.oxlintrc.json'));

  // Only plain JSON survives a rewrite: without this, `updateJson` strips a
  // `.jsonc`'s comments and throws outright on a TypeScript config.
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
      // Not added automatically: a config without `extends` may be isolating
      // deliberately. Silent when an `extends` exists (it may reach the governing
      // config through a preset) or the nearest ancestor is TypeScript.
      if (governingConfigPath && !json.extends?.length && projectRoot !== '.') {
        logger.warn(
          `"${projectRoot}" has an Oxlint config with no "extends", so ${governingConfigPath}'s ` +
            `categories and rules do not apply to it. The plugin(s) ${plugins.join(
              ', '
            )} still run, but under Oxlint's defaults — so this project can pass lint on ` +
            `violations ${governingConfigPath} would fail it for. Add "extends": ["${joinPathFragments(
              offsetFromRoot(projectRoot),
              governingConfigPath
            )}"] if that is not intended.`
        );
      }
      return json;
    });
    return;
  }

  writeJson<OxlintConfig>(tree, projectConfigPath, {
    extends: [
      joinPathFragments(offsetFromRoot(projectRoot), governingConfigPath),
    ],
    plugins: [...plugins],
  });
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}
