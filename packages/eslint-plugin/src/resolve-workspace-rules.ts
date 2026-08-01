import { workspaceRoot } from '@nx/devkit';
import { loadConfigFile } from '@nx/devkit/internal';
import {
  forceRegisterEsmLoader,
  loadTsFile,
  registerTsConfigPaths,
} from '@nx/js/internal';
import type { TSESLint } from '@typescript-eslint/utils';
import { existsSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'path';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULE_PREFIX } from './constants';

// `new Function` keeps TS from down-leveling `import()` to `require()`.
const dynamicImport = new Function('p', 'return import(p);');

type ESLintRules = Record<string, TSESLint.RuleModule<string, unknown[]>>;

// ESM import() cannot resolve directories to index files like require() can
const INDEX_FILE_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
] as const;

function resolveDirectoryEntryFile(directory: string): string {
  for (const ext of INDEX_FILE_EXTENSIONS) {
    const candidatePath = join(directory, `index${ext}`);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `No index file found in directory: ${directory}. ` +
      `Expected one of: ${INDEX_FILE_EXTENSIONS.map(
        (ext) => `index${ext}`
      ).join(', ')}`
  );
}

function normalizePath(path: string): string {
  return `${normalize(path).replace(/[\/\\]$/g, '')}${sep}`;
}

function findTsConfig(
  directory: string,
  tsConfigPath?: string
): string | undefined {
  let effectiveTsConfigPath = tsConfigPath;
  const normalizedWorkspaceRoot = normalizePath(workspaceRoot);

  if (effectiveTsConfigPath) {
    if (!isAbsolute(effectiveTsConfigPath)) {
      effectiveTsConfigPath = resolve(workspaceRoot, effectiveTsConfigPath);
    }

    if (!effectiveTsConfigPath.startsWith(normalizedWorkspaceRoot)) {
      console.warn(
        `TypeScript config "${effectiveTsConfigPath}" is outside the workspace root "${workspaceRoot}". Falling back to automatic tsconfig detection.`
      );
      effectiveTsConfigPath = undefined;
    }
  }

  if (!effectiveTsConfigPath) {
    let currentDir = directory;

    while (currentDir.startsWith(normalizedWorkspaceRoot)) {
      const candidatePath = join(currentDir, 'tsconfig.json');
      if (existsSync(candidatePath)) {
        effectiveTsConfigPath = candidatePath;
        break;
      }

      const parentDir = dirname(currentDir);
      if (normalizePath(parentDir) === normalizedWorkspaceRoot) {
        break;
      }
      currentDir = parentDir;
    }
  }

  if (!tsConfigPath && !effectiveTsConfigPath) {
    console.warn(
      `No TypeScript config found. Crawled up to workspace root "${workspaceRoot}" ` +
        `from directory "${directory}" without finding a tsconfig.json file. Provide ` +
        `a tsconfig.json file path to the loadWorkspaceRules function.`
    );
  }

  return effectiveTsConfigPath;
}

/**
 * Load ESLint rules from a directory.
 *
 * This utility allows loading custom ESLint rules from any directory within the workspace,
 * not just the default `tools/eslint-rules` location. It's useful for:
 * - Loading rules from a custom directory structure
 * - Loading rules from npm workspace packages (e.g., linked packages via npm/yarn/pnpm workspaces)
 * - Loading rules from multiple directories with different configurations
 *
 * The directory must contain an index file (index.ts, index.js, etc.) that exports the rules.
 *
 * @param directory - The directory path to load rules from. Can be absolute or relative to workspace root.
 * @param tsConfigPath - Optional path to tsconfig.json for TypeScript compilation.
 *                       If not provided, will search for tsconfig.json starting from
 *                       the directory and traversing up to the workspace root.
 * @returns An object containing the loaded ESLint rules (without any prefix).
 *          Returns an empty object if the directory doesn't exist or loading fails.
 *
 * @example
 * ```typescript
 * // Load rules from a custom directory (relative to workspace root)
 * const customRules = await loadWorkspaceRules('packages/my-eslint-plugin/rules');
 *
 * // Load rules with a specific tsconfig
 * const customRules = await loadWorkspaceRules(
 *   'packages/my-eslint-plugin/rules',
 *   'packages/my-eslint-plugin/tsconfig.json'
 * );
 *
 * // Or use absolute paths
 * const customRules = loadWorkspaceRules('/absolute/path/to/rules');
 * ```
 */
export async function loadWorkspaceRules(
  directory: string,
  tsConfigPath?: string
): Promise<ESLintRules> {
  const resolvedDirectory = isAbsolute(directory)
    ? directory
    : resolve(workspaceRoot, directory);

  if (!resolvedDirectory.startsWith(normalizePath(workspaceRoot))) {
    console.warn(
      `Directory "${resolvedDirectory}" is outside the workspace root "${workspaceRoot}". ESLint rules can only be loaded from within the workspace.`
    );
    return {};
  }

  if (!existsSync(resolvedDirectory)) {
    console.warn(
      `Directory "${resolvedDirectory}" does not exist. Skipping loading ESLint rules from this directory.`
    );
    return {};
  }

  try {
    const entryFile = resolveDirectoryEntryFile(resolvedDirectory);
    const effectiveTsConfigPath = findTsConfig(resolvedDirectory, tsConfigPath);

    // For TS entry files, use loadTsFile directly so the explicitly-provided
    // tsConfigPath threads into any swc/ts-node fallback. For other extensions
    // (or when no tsconfig was found), defer to loadConfigFile's auto-discovery.
    const isTs = !!effectiveTsConfigPath && /\.(c|m)?ts$/.test(entryFile);
    let module: { rules?: ESLintRules } | ESLintRules;
    if (isTs) {
      try {
        module = loadTsFile<{ rules?: ESLintRules }>(
          entryFile,
          effectiveTsConfigPath
        );
      } catch (err: any) {
        // Top-level await (`ERR_REQUIRE_ASYNC_MODULE`) and ESM-only modules
        // (`ERR_REQUIRE_ESM`) must be loaded via dynamic import(). Mirror
        // devkit's loadTypeScriptModule: register tsconfig-paths first so
        // workspace alias imports resolve, then try native dynamic import.
        // Only escalate to forceRegisterEsmLoader on unsupported TS syntax
        // (enum, runtime namespace, etc.) - surface the original ESM error
        // if no loader can be installed. Without this the outer catch
        // swallows the error and the lint run silently has no rules.
        if (
          err?.code !== 'ERR_REQUIRE_ESM' &&
          err?.code !== 'ERR_REQUIRE_ASYNC_MODULE'
        ) {
          throw err;
        }
        const cleanupPaths = registerTsConfigPaths(effectiveTsConfigPath);
        try {
          const entryUrl = pathToFileURL(entryFile).href;
          try {
            module = await dynamicImport(entryUrl);
          } catch (esmErr: any) {
            if (esmErr?.code !== 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
              throw esmErr;
            }
            try {
              forceRegisterEsmLoader();
            } catch {
              throw esmErr;
            }
            module = await dynamicImport(entryUrl);
          }
        } finally {
          cleanupPaths();
        }
      }
    } else {
      // Pre-register tsconfig-paths so a `.js`/`.mjs`/`.cjs` workspace
      // eslint plugin can still import workspace libs via TS path aliases
      // (pre-PR behavior: loadConfigFile was always preceded by
      // registerTsProject).
      let cleanupPaths: (() => void) | undefined;
      if (effectiveTsConfigPath) {
        cleanupPaths = registerTsConfigPaths(effectiveTsConfigPath);
      }
      try {
        module = await loadConfigFile<{ rules?: ESLintRules }>(entryFile);
      } finally {
        cleanupPaths?.();
      }
    }
    const rules = (module as { rules?: ESLintRules }).rules || module;

    return rules as ESLintRules;
  } catch (err) {
    console.error(err);
    return {};
  }
}

export const workspaceRules = ((): ESLintRules => {
  // If `tools/eslint-rules` folder doesn't exist, there is no point trying to register and load it
  if (!existsSync(WORKSPACE_PLUGIN_DIR)) {
    return {};
  }
  try {
    /**
     * Currently we only support applying the rules from the user's workspace plugin object
     * (i.e. not other things that plugings can expose like configs, processors etc)
     */
    const { rules } = loadTsFile(
      WORKSPACE_PLUGIN_DIR,
      join(WORKSPACE_PLUGIN_DIR, 'tsconfig.json')
    );

    // Apply the namespace to the resolved rules
    const namespacedRules: ESLintRules = {};
    for (const [ruleName, ruleConfig] of Object.entries(rules as ESLintRules)) {
      namespacedRules[`${WORKSPACE_RULE_PREFIX}-${ruleName}`] = ruleConfig;
      // keep the old namespaced rules for backwards compatibility
      namespacedRules[`${WORKSPACE_RULE_PREFIX}/${ruleName}`] = ruleConfig;
    }
    return namespacedRules;
  } catch (err) {
    console.error(err);
    return {};
  }
})();
