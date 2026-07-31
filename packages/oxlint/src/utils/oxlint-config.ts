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
 * Config files whose contents can be read statically. Not all of them can be
 * rewritten — `addPluginsToOxlintConfig` below refuses `.jsonc`, because
 * `updateJson` would strip its comments.
 */
const EDITABLE_CONFIG_FILENAMES = OXLINT_CONFIG_FILENAMES.filter((file) =>
  /\.jsonc?$/.test(file)
);

interface OxlintConfig {
  extends?: string[];
  plugins?: string[];
}

export function findRootOxlintConfig(tree: Tree): string | null {
  return EDITABLE_CONFIG_FILENAMES.find((file) => tree.exists(file)) ?? null;
}

/**
 * Enables Oxlint plugins for a single project, in that project's own config.
 *
 * A nested config *replaces* the root one for its subtree rather than merging
 * into it, so the generated config extends the root explicitly. Without that
 * `extends`, the root's `categories` and `rules` silently stop applying.
 *
 * No-op when the workspace uses a TypeScript config (`oxlint.config.ts`), which
 * cannot be rewritten statically.
 */
export function addPluginsToOxlintConfig(
  tree: Tree,
  projectRoot: string,
  plugins: string[]
): void {
  if (!plugins.length) {
    return;
  }

  // Reuse whichever editable config the project already has: writing
  // `.oxlintrc.json` beside an existing `.oxlintrc.jsonc` is a hard error in
  // Oxlint, not an override.
  const existingProjectConfig =
    projectRoot === '.'
      ? undefined
      : EDITABLE_CONFIG_FILENAMES.map((file) =>
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

  // `updateJson` parses comments away and re-serializes, so rewriting a `.jsonc`
  // would discard the one thing that format is for.
  if (projectConfigPath.endsWith('.jsonc')) {
    logger.warn(
      `Could not enable the Oxlint plugin(s) ${plugins.join(
        ', '
      )} for "${projectRoot}": rewriting ${projectConfigPath} would strip its comments. ` +
        `Add them to its "plugins" array manually.`
    );
    return;
  }

  if (tree.exists(projectConfigPath)) {
    updateJson<OxlintConfig>(tree, projectConfigPath, (json) => {
      json.plugins = union(json.plugins ?? [], plugins);
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
