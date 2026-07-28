import {
  joinPathFragments,
  offsetFromRoot,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { OXLINT_CONFIG_FILENAMES } from './config-file.js';

/** Config files whose contents can be read and rewritten statically. */
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

  const rootConfigPath = findRootOxlintConfig(tree);
  if (!rootConfigPath) {
    return;
  }

  // A root project has no config to nest — the root config is its own.
  const projectConfigPath =
    projectRoot === '.'
      ? rootConfigPath
      : joinPathFragments(projectRoot, '.oxlintrc.json');

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
