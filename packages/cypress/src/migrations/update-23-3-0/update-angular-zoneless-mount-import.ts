import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  readJson,
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type GeneratorCallback,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { StringLiteralLike } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations';

// Cypress 16 dropped the `cypress/angular-zoneless` export and deprecated the
// standalone npm package of the same harness; `cypress/angular` is zoneless there.
const OLD_SPECIFIERS = new Set([
  'cypress/angular-zoneless',
  '@cypress/angular-zoneless',
]);
const DEPRECATED_PACKAGE = '@cypress/angular-zoneless';
const NEW_SPECIFIER = 'cypress/angular';

let ts: typeof import('typescript');

export default async function updateAngularZonelessMountImport(
  tree: Tree
): Promise<GeneratorCallback | void> {
  let wereFilesMigrated = false;

  for await (const { projectConfig } of cypressProjectConfigs(tree)) {
    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
        return;
      }

      const originalContent = tree.read(filePath, 'utf-8');
      if (!originalContent.includes('angular-zoneless')) {
        return;
      }

      const changes = findModuleSpecifiers(originalContent).map(
        (specifier): StringChange[] => {
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
        }
      );
      if (changes.length === 0) {
        return;
      }

      tree.write(
        filePath,
        applyChangesToString(originalContent, changes.flat())
      );
      wereFilesMigrated = true;
    });
  }

  const installTask = removeDeprecatedPackage(tree);

  if (wereFilesMigrated) {
    await formatFiles(tree);
  }

  return installTask;
}

function removeDeprecatedPackage(tree: Tree): GeneratorCallback | undefined {
  const { dependencies = {}, devDependencies = {} } = readJson(
    tree,
    'package.json'
  );
  if (
    !dependencies[DEPRECATED_PACKAGE] &&
    !devDependencies[DEPRECATED_PACKAGE]
  ) {
    return undefined;
  }

  return removeDependenciesFromPackageJson(
    tree,
    [DEPRECATED_PACKAGE],
    [DEPRECATED_PACKAGE]
  );
}

// `import`/`export ... from`, `import()`, `typeof import()` and `require()` forms.
function findModuleSpecifiers(content: string): StringLiteralLike[] {
  ts ??= ensureTypescript();

  return query<StringLiteralLike>(
    ast(content),
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
      ts.isCallExpression(parent) &&
      parent.arguments[0] === literal &&
      (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(parent.expression) &&
          parent.expression.text === 'require'))
    );
  });
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
