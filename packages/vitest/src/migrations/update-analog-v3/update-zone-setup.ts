import { globAsync, type Tree } from '@nx/devkit';
import { getDeclaredPackageVersion } from '@nx/devkit/internal';
import { major } from 'semver';
import ts = require('typescript');

export default async function updateZoneSetup(tree: Tree) {
  const version = getDeclaredPackageVersion(tree, '@analogjs/vitest-angular');
  if (!version || major(version) !== 3) return;

  const files = await globAsync(tree, [
    '**/{vitest.config,vite.config,test-setup,setup-test}.{js,mjs,cjs,ts,mts,cts}',
  ]);
  for (const file of files) {
    const content = tree.read(file, 'utf-8');
    const legacy = '@analogjs/vite-plugin-angular/setup-vitest';
    if (!content?.includes(legacy)) continue;
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    let updated = content;
    for (const stmt of source.statements.slice().reverse()) {
      if (
        ts.isImportDeclaration(stmt) &&
        !stmt.importClause &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === legacy
      ) {
        const literal = stmt.moduleSpecifier;
        updated =
          updated.slice(0, literal.getStart(source) + 1) +
          '@analogjs/vitest-angular/setup-zone' +
          updated.slice(literal.end - 1);
      }
    }
    if (updated !== content) tree.write(file, updated);
  }
}
