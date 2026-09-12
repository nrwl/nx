import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  readJson,
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { SourceFile, StringLiteralLike } from 'typescript';
import { hasLocalValueBinding } from '../../utils/migrations';

// Cypress 16 dropped the `cypress/angular-zoneless` export and deprecated the
// standalone npm package of the same harness; `cypress/angular` is zoneless there.
const OLD_SPECIFIERS = new Set([
  'cypress/angular-zoneless',
  '@cypress/angular-zoneless',
]);
const DEPRECATED_PACKAGE = '@cypress/angular-zoneless';
const NEW_SPECIFIER = 'cypress/angular';

let ts: typeof import('typescript');

export default async function updateAngularZonelessMountImport(tree: Tree) {
  let wereFilesMigrated = false;
  const shadowedRequires: string[] = [];

  // Shared support libraries can hold the import, so the whole workspace is
  // scanned rather than the Cypress project roots.
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const originalContent = tree.read(filePath, 'utf-8');
    if (!originalContent.includes('angular-zoneless')) {
      return;
    }

    const sourceFile = ast(originalContent);
    const specifiers = findModuleSpecifiers(sourceFile);
    // A file with its own `require` value is not calling the CommonJS loader.
    const shadowsRequire =
      specifiers.some(isRequireArgument) &&
      hasLocalValueBinding(sourceFile, 'require');
    if (shadowsRequire) {
      shadowedRequires.push(filePath);
    }

    const changes = specifiers
      .filter((specifier) => !shadowsRequire || !isRequireArgument(specifier))
      .map((specifier): StringChange[] => {
        const quote = specifier.getText()[0];
        const start = specifier.getStart();
        return [
          {
            type: ChangeType.Delete,
            start,
            length: specifier.getEnd() - start,
          },
          {
            type: ChangeType.Insert,
            index: start,
            text: `${quote}${NEW_SPECIFIER}${quote}`,
          },
        ];
      });
    if (changes.length === 0) {
      return;
    }

    tree.write(filePath, applyChangesToString(originalContent, changes.flat()));
    wereFilesMigrated = true;
  });

  removeDeprecatedPackage(tree);

  if (wereFilesMigrated) {
    await formatFiles(tree);
  }

  if (shadowedRequires.length > 0) {
    const notes = shadowedRequires.map(
      (filePath) =>
        `Left the \`require()\` calls in ${filePath} untouched because it declares its own \`require\`; point them at \`${NEW_SPECIFIER}\` by hand if they load the Cypress harness`
    );
    return { nextSteps: notes, agentContext: notes };
  }
}

function removeDeprecatedPackage(tree: Tree): void {
  const { dependencies = {}, devDependencies = {} } = readJson(
    tree,
    'package.json'
  );
  if (
    !dependencies[DEPRECATED_PACKAGE] &&
    !devDependencies[DEPRECATED_PACKAGE]
  ) {
    return;
  }

  removeDependenciesFromPackageJson(
    tree,
    [DEPRECATED_PACKAGE],
    [DEPRECATED_PACKAGE]
  );
}

// `import`/`export ... from`, `import()`, `typeof import()` and `require()` forms.
function findModuleSpecifiers(sourceFile: SourceFile): StringLiteralLike[] {
  ts ??= ensureTypescript();

  return query<StringLiteralLike>(
    sourceFile,
    `:matches(StringLiteral, NoSubstitutionTemplateLiteral)`
  ).filter((literal) => {
    if (!OLD_SPECIFIERS.has(literal.text)) {
      return false;
    }
    const parent = literal.parent;
    if (
      ts.isImportDeclaration(parent) ||
      ts.isExportDeclaration(parent) ||
      ts.isExternalModuleReference(parent) ||
      (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent))
    ) {
      return true;
    }
    return (
      (ts.isCallExpression(parent) &&
        parent.arguments[0] === literal &&
        parent.expression.kind === ts.SyntaxKind.ImportKeyword) ||
      isRequireArgument(literal)
    );
  });
}

function isRequireArgument(literal: StringLiteralLike): boolean {
  const parent = literal.parent;
  return (
    ts.isCallExpression(parent) &&
    parent.arguments[0] === literal &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === 'require'
  );
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
