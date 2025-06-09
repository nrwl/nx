import {
  addDependenciesToPackageJson,
  formatFiles,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import * as ts from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { angularDevkitVersion } from '../../utils/versions';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/platform-server',
  ]);

  if (!projects.length) {
    return;
  }

  let isSsrInstalled = false;
  for (const { project } of projects) {
    visitNotIgnoredFiles(tree, project.root, (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        return;
      }

      const shouldInstallSsr = processFile(tree, file);

      if (shouldInstallSsr && !isSsrInstalled) {
        isSsrInstalled = true;
        addDependenciesToPackageJson(
          tree,
          { '@angular/ssr': angularDevkitVersion },
          {},
          undefined,
          true
        );
      }
    });
  }

  await formatFiles(tree);
}

function processFile(tree: Tree, filePath: string): boolean {
  const content = tree.read(filePath, 'utf-8');

  if (
    !content.includes('provideServerRendering') ||
    !content.includes('@angular/platform-server')
  ) {
    return false;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  let platformServerHasProvideServerRendering = false;
  let platformServerImportNode: ts.ImportDeclaration | undefined;
  let ssrImportNode: ts.ImportDeclaration | undefined;
  const platformServerImports = new Set<string>();

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) {
      return;
    }

    const moduleSpecifier = node.moduleSpecifier.getText(sourceFile);
    if (moduleSpecifier.includes('@angular/platform-server')) {
      platformServerImportNode = node;
      const importClause = node.importClause;
      if (
        importClause &&
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        const namedImports = importClause.namedBindings.elements.map((e) =>
          e.getText(sourceFile)
        );
        namedImports.forEach((importName) => {
          if (importName === 'provideServerRendering') {
            platformServerHasProvideServerRendering = true;
          } else {
            platformServerImports.add(importName);
          }
        });
      }
    } else if (moduleSpecifier.includes('@angular/ssr')) {
      ssrImportNode = node;
    }
  });

  if (!platformServerHasProvideServerRendering) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });
  if (
    ssrImportNode?.importClause?.namedBindings &&
    ts.isNamedImports(ssrImportNode.importClause.namedBindings)
  ) {
    const namedBindingsNode = ssrImportNode.importClause!
      .namedBindings as ts.NamedImports;
    const updatedNamedBindingsNode = ts.factory.updateNamedImports(
      namedBindingsNode,
      [
        ...namedBindingsNode.elements,
        ts.factory.createImportSpecifier(
          false,
          undefined,
          ts.factory.createIdentifier('provideServerRendering')
        ),
      ]
    );
    recorder.replace(
      namedBindingsNode,
      printer.printNode(
        ts.EmitHint.Unspecified,
        updatedNamedBindingsNode,
        sourceFile
      )
    );
  } else {
    /**
     * Add a new import statement with the needed named import in case it
     * doesn't exist yet or it doesn't have named imports.
     *
     * It would be quite uncommon to have an import from @angular/ssr without
     * named imports, but if that's the case, we'll just add an extra import
     * statement with the needed named import.
     */
    recorder.insertLeft(
      0,
      `import { provideServerRendering } from '@angular/ssr';\n`
    );
  }

  if (platformServerImports.size > 0) {
    // we only collected platform server imports because there were named
    // imports, so we can safely use the type
    const namedBindingsNode = platformServerImportNode.importClause!
      .namedBindings as ts.NamedImports;
    const updatedNamedBindingsNode = ts.factory.updateNamedImports(
      namedBindingsNode,
      namedBindingsNode.elements.filter((e) =>
        platformServerImports.has(e.getText(sourceFile))
      )
    );
    recorder.replace(
      namedBindingsNode,
      printer.printNode(
        ts.EmitHint.Unspecified,
        updatedNamedBindingsNode,
        sourceFile
      )
    );
  } else {
    recorder.remove(
      platformServerImportNode.getFullStart(),
      platformServerImportNode.getEnd()
    );
  }

  recorder.applyChanges();

  return true;
}
