import {
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  formatFiles,
  StringChange,
  Tree,
  visitNotIgnoredFiles,
  readJson,
} from '@nrwl/devkit';
import {
  createSourceFile,
  ImportSpecifier,
  isImportDeclaration,
  isNamedImports,
  isStringLiteral,
  ScriptTarget,
} from 'typescript';
import { extname } from 'path';
import { checkAndCleanWithSemver } from '@nrwl/workspace';
import { gte } from 'semver';
import { rxjsVersion as defaultRxjsVersion } from '../../utils/versions';

export default async function (tree: Tree) {
  const identifiers = ['hot', 'cold', 'getTestScheduler', 'time'];
  let shouldAddJasmineMarbles = false;
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (extname(filePath) !== '.ts') {
      return;
    }
    const updated = updateImports(
      tree,
      filePath,
      identifiers,
      '@nrwl/angular/testing',
      'jasmine-marbles'
    );
    shouldAddJasmineMarbles = shouldAddJasmineMarbles || updated;
  });

  if (shouldAddJasmineMarbles) {
    let rxjsVersion: string;
    try {
      rxjsVersion = checkAndCleanWithSemver(
        'rxjs',
        readJson(tree, 'package.json').dependencies['rxjs']
      );
    } catch {
      rxjsVersion = checkAndCleanWithSemver('rxjs', defaultRxjsVersion);
    }
    const jasmineMarblesVersion = gte(rxjsVersion, '7.0.0')
      ? '~0.9.1'
      : '~0.8.3';

    addDependenciesToPackageJson(
      tree,
      {},
      {
        'jasmine-marbles': jasmineMarblesVersion,
      }
    );
  }

  await formatFiles(tree);
}

function updateImports(
  tree: Tree,
  filePath: string,
  identifiers: string[],
  oldModule: string,
  newModule: string
) {
  const contents = tree.read(filePath).toString();
  const sourceFile = createSourceFile(filePath, contents, ScriptTarget.Latest);
  let changes: StringChange[] = [];

  const identifiersToAdd = [];
  for (const statement of sourceFile.statements) {
    if (
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === oldModule &&
      isNamedImports(statement.importClause.namedBindings)
    ) {
      const remainingElements: ImportSpecifier[] = [];
      for (const namedBinding of statement.importClause.namedBindings
        .elements) {
        const identifier = namedBinding.name.getText(sourceFile);
        if (!identifiers.includes(namedBinding.name.getText(sourceFile))) {
          remainingElements.push(namedBinding);
        } else {
          identifiersToAdd.push(identifier);
        }
      }
      if (
        remainingElements.length ===
        statement.importClause.namedBindings.elements.length
      ) {
        continue;
      } else if (remainingElements.length === 0) {
        changes.push({
          type: ChangeType.Delete,
          start: statement.getFullStart(),
          length: statement.getFullWidth(),
        });
      } else {
        changes.push(
          {
            type: ChangeType.Delete,
            start: statement.importClause.getStart(sourceFile),
            length: statement.importClause.getWidth(sourceFile),
          },
          {
            type: ChangeType.Insert,
            index: statement.importClause.getStart(sourceFile),
            text: `{ ${remainingElements
              .map((importSpecifier) => importSpecifier.getText(sourceFile))
              .join(', ')} }`,
          }
        );
      }
    }
  }
  if (identifiersToAdd.length > 0) {
    let afterImports = 0;

    for (const statement of sourceFile.statements) {
      if (isImportDeclaration(statement)) {
        afterImports = statement.getEnd();
      }
    }

    changes.push({
      type: ChangeType.Insert,
      index: afterImports,
      text: `\nimport { ${Array.from(new Set(identifiersToAdd)).join(
        ', '
      )} } from '${newModule}';`,
    });
  }

  if (changes.length > 0) {
    tree.write(filePath, applyChangesToString(contents, changes));
    return true;
  } else {
    return false;
  }
}
