import { updateJson, type Tree } from '@nx/devkit';
import { OXLINT_CONFIG_FILENAMES } from './config-file.js';

/** Config files whose contents can be read and rewritten statically. */
const EDITABLE_CONFIG_FILENAMES = OXLINT_CONFIG_FILENAMES.filter((file) =>
  /\.jsonc?$/.test(file)
);

interface OxlintOverride {
  files?: string[];
  plugins?: string[];
}

interface OxlintConfig {
  plugins?: string[];
  overrides?: OxlintOverride[];
}

export function findRootOxlintConfig(tree: Tree): string | null {
  return EDITABLE_CONFIG_FILENAMES.find((file) => tree.exists(file)) ?? null;
}

/**
 * Enables Oxlint plugins for a single project, via an `overrides` entry scoped
 * to its root.
 *
 * Scoped rather than added to the top-level `plugins`, so a React plugin does
 * not start applying to a Vue project's `.tsx` files in a mixed workspace.
 *
 * No-op when the workspace uses a TypeScript config (`oxlint.config.ts`),
 * which cannot be rewritten statically.
 */
export function addPluginsToOxlintConfig(
  tree: Tree,
  projectRoot: string,
  plugins: string[]
): void {
  if (!plugins.length) {
    return;
  }

  const configPath = findRootOxlintConfig(tree);
  if (!configPath) {
    return;
  }

  const files = projectRoot === '.' ? '**/*' : `${projectRoot}/**/*`;

  updateJson<OxlintConfig>(tree, configPath, (json) => {
    json.overrides ??= [];

    const existing = json.overrides.find((override) =>
      override.files?.includes(files)
    );
    if (existing) {
      existing.plugins = union(existing.plugins ?? [], plugins);
      return json;
    }

    json.overrides.push({ files: [files], plugins: [...plugins] });
    return json;
  });
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}
