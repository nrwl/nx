import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:jest-preset-angular',
  ]);

  if (!projects.length) {
    return;
  }

  // The old 'jest-preset-angular/setup-jest' import only supported zone-based testing.
  // Zoneless support was added in jest-preset-angular v14.3.0 with the new
  // setupZonelessTestEnv function. Therefore, all projects using the old import
  // were zone-based and should be migrated to setupZoneTestEnv.

  // Regex patterns to match removed imports
  // Matches: import 'jest-preset-angular/setup-jest'; (with optional .js/.mjs extension)
  // Captures .mjs extension in group 3 to preserve it in the replacement
  const setupJestImportRegex =
    /^(\s*)import\s+(['"`])jest-preset-angular\/setup-jest(?:\.js)?(\.mjs)?\2;?\s*$/gm;
  // Matches: require('jest-preset-angular/setup-jest'); (with optional .js extension)
  // Note: .mjs is not supported with require() so we don't capture it
  const setupJestRequireRegex =
    /^(\s*)require\s*\(\s*(['"`])jest-preset-angular\/setup-jest(?:\.js)?\2\s*\)\s*;?\s*$/gm;

  for (const project of projects) {
    visitNotIgnoredFiles(tree, project.data.root, (file) => {
      if (!file.endsWith('.ts')) {
        return;
      }

      let content = tree.read(file, 'utf-8');
      if (!content.includes('jest-preset-angular/setup-jest')) {
        return;
      }

      let wasUpdated = false;

      // Replace import statements, preserving .mjs extension if present
      setupJestImportRegex.lastIndex = 0;
      if (setupJestImportRegex.test(content)) {
        setupJestImportRegex.lastIndex = 0;
        content = content.replace(
          setupJestImportRegex,
          (_match, _leadingWhitespace, _quote, mjsExt) => {
            const modulePath = mjsExt
              ? 'jest-preset-angular/setup-env/zone/index.mjs'
              : 'jest-preset-angular/setup-env/zone';
            return `import { setupZoneTestEnv } from '${modulePath}';

setupZoneTestEnv();`;
          }
        );
        wasUpdated = true;
      }

      // Replace require statements, keeping require syntax
      setupJestRequireRegex.lastIndex = 0;
      if (setupJestRequireRegex.test(content)) {
        setupJestRequireRegex.lastIndex = 0;
        content = content.replace(
          setupJestRequireRegex,
          `const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');

setupZoneTestEnv();`
        );
        wasUpdated = true;
      }

      if (wasUpdated) {
        tree.write(file, content);
      }
    });
  }

  await formatFiles(tree);
}
