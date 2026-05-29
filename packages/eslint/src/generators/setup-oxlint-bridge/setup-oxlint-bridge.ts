import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { findEslintFile } from '../utils/eslint-file';
import { eslintPluginOxlintVersion, jitiVersion } from '../../utils/versions';
import type { SetupOxlintBridgeSchema } from './schema';

/**
 * Injects the JITI bridge into an existing ESLint flat config so that
 * `eslint-plugin-oxlint` can dynamically read `oxlint.config.ts` and
 * disable overlapping ESLint rules via `buildFromOxlintConfig()`.
 *
 * This is the community-standard pattern used by Analog alpha, documented
 * by `eslint-plugin-oxlint`, and recommended for ESLint/Oxlint coexistence
 * during gradual migration.
 */
export async function setupOxlintBridgeGenerator(
  tree: Tree,
  options: SetupOxlintBridgeSchema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const oxlintConfigPath = options.oxlintConfigPath ?? './oxlint.config.ts';

  // 1. Find the existing ESLint flat config
  const eslintFile = findEslintFile(tree);
  if (!eslintFile) {
    throw new Error(
      'No ESLint config file found. Run `nx g @nx/eslint:init` first.'
    );
  }

  const content = tree.read(eslintFile, 'utf-8');
  const isFlatConfig =
    content.includes('export default') || content.includes('module.exports');
  if (!isFlatConfig) {
    throw new Error(
      `The ESLint config "${eslintFile}" does not appear to be a flat config. ` +
        'Convert to flat config first with `nx g @nx/eslint:convert-to-flat-config`.'
    );
  }

  // 2. Check if the bridge is already set up
  if (content.includes('eslint-plugin-oxlint')) {
    logger.info(
      'eslint-plugin-oxlint is already referenced in the ESLint config. Skipping.'
    );
    return () => {};
  }

  // 3. Install dependencies
  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          'eslint-plugin-oxlint': eslintPluginOxlintVersion,
          jiti: jitiVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  // 4. Inject the bridge into the ESLint config
  const format = content.includes('export default') ? 'mjs' : 'cjs';
  const updatedContent = injectOxlintBridge(content, format, oxlintConfigPath);
  tree.write(eslintFile, updatedContent);

  // 5. Format
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

/**
 * Injects the JITI bridge code into an ESLint flat config string.
 *
 * Adds:
 * - `import oxlint from 'eslint-plugin-oxlint'`
 * - `import { createJiti } from 'jiti'`
 * - Top-level JITI import of oxlint.config.ts
 * - `reportUnusedDisableDirectives: 'off'` config block
 * - `...oxlint.buildFromOxlintConfig(oxlintConfig)` spread at end
 */
export function injectOxlintBridge(
  content: string,
  format: 'mjs' | 'cjs',
  oxlintConfigPath: string
): string {
  if (format === 'mjs') {
    return injectOxlintBridgeESM(content, oxlintConfigPath);
  }
  return injectOxlintBridgeCJS(content, oxlintConfigPath);
}

function injectOxlintBridgeESM(
  content: string,
  oxlintConfigPath: string
): string {
  // Add imports before the export default
  const importBlock = [
    `import oxlint from 'eslint-plugin-oxlint';`,
    `import { createJiti } from 'jiti';`,
    '',
    `const jiti = createJiti(import.meta.url);`,
    `const oxlintConfig = /** @type {{ default: import('oxlint').OxlintConfig }} */ (`,
    `  await jiti.import('${oxlintConfigPath}')`,
    `).default;`,
  ].join('\n');

  // Find the export default position and insert imports before it
  const exportIdx = content.indexOf('export default');
  if (exportIdx === -1) {
    return content;
  }

  const before = content.slice(0, exportIdx).trimEnd();
  const after = content.slice(exportIdx);

  // Build the bridge config blocks to append inside the export array
  const bridgeBlocks = [
    `  {`,
    `    linterOptions: {`,
    `      reportUnusedDisableDirectives: 'off',`,
    `    },`,
    `  },`,
    `  ...oxlint.buildFromOxlintConfig(oxlintConfig)`,
  ].join('\n');

  // Insert bridge blocks at the end of the export array
  const updatedAfter = insertBeforeClosingBracket(after, bridgeBlocks);

  return `${before}\n${importBlock}\n\n${updatedAfter}`;
}

function injectOxlintBridgeCJS(
  content: string,
  oxlintConfigPath: string
): string {
  // CJS: use require() and synchronous JITI
  const importBlock = [
    `const oxlint = require('eslint-plugin-oxlint');`,
    `const { createJiti } = require('jiti');`,
    '',
    `const jiti = createJiti(__filename);`,
    `const oxlintConfig = jiti.import('${oxlintConfigPath}', { default: true });`,
  ].join('\n');

  const exportsIdx = content.indexOf('module.exports');
  if (exportsIdx === -1) {
    return content;
  }

  const before = content.slice(0, exportsIdx).trimEnd();
  const after = content.slice(exportsIdx);

  const bridgeBlocks = [
    `  {`,
    `    linterOptions: {`,
    `      reportUnusedDisableDirectives: 'off',`,
    `    },`,
    `  },`,
    `  ...oxlint.buildFromOxlintConfig(oxlintConfig)`,
  ].join('\n');

  const updatedAfter = insertBeforeClosingBracket(after, bridgeBlocks);

  return `${before}\n${importBlock}\n\n${updatedAfter}`;
}

/**
 * Insert content before the last `];` in the string. This appends
 * config blocks to the end of the flat config export array.
 */
function insertBeforeClosingBracket(
  content: string,
  insertion: string
): string {
  // Find the last `];` which closes the export default array
  const closingIdx = content.lastIndexOf('];');
  if (closingIdx === -1) {
    return content;
  }

  const before = content.slice(0, closingIdx).trimEnd();
  const after = content.slice(closingIdx);

  // Ensure trailing comma on the last element
  const needsComma = !before.trimEnd().endsWith(',');
  const comma = needsComma ? ',' : '';

  return `${before}${comma}\n${insertion},\n${after}`;
}

export default setupOxlintBridgeGenerator;
