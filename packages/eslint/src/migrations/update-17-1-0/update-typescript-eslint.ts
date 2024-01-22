import {
  applyChangesToString,
  ChangeType,
  ensurePackage,
  formatFiles,
  StringChange,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { extname } from 'path';
import {
  createSourceFile,
  forEachChild,
  isIdentifier,
  isPropertyAssignment,
  isStringLiteral,
  type Node,
  ScriptTarget,
} from 'typescript';

function updateJestConfig(tree: Tree) {
  const jestConfigPath = 'tools/eslint-rules/jest.config.ts';
  if (tree.exists(jestConfigPath)) {
    const { removePropertyFromJestConfig } = ensurePackage<
      typeof import('@nx/jest')
    >('@nx/jest', nxVersion);

    removePropertyFromJestConfig(tree, jestConfigPath, [
      'moduleNameMapper',
      '@eslint/eslintrc',
    ]);
  }
}

function updateTsConfigs(tree: Tree) {
  const tsConfigPath = 'tools/eslint-rules/tsconfig.json';
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (tsConfig) => {
      tsConfig.compilerOptions ??= {};
      tsConfig.compilerOptions.moduleResolution = 'node16';
      tsConfig.compilerOptions.module = 'node16';
      return tsConfig;
    });
  }
  const tsConfigSpec = 'tools/eslint-rules/tsconfig.spec.json';
  if (tree.exists(tsConfigSpec)) {
    updateJson(tree, tsConfigSpec, (tsConfigSpec) => {
      delete tsConfigSpec.compilerOptions?.module;
      delete tsConfigSpec.compilerOptions?.moduleResolution;
      return tsConfigSpec;
    });
  }
}

function updateRecommended(tree: Tree) {
  visitNotIgnoredFiles(tree, 'tools/eslint-rules', (path) => {
    if (extname(path) !== '.ts') {
      return;
    }

    const contents = tree.read(path, 'utf-8');
    const sourceFile = createSourceFile(
      path,
      contents,
      ScriptTarget.ESNext,
      true
    );

    const changes: StringChange[] = [];

    const visit = (node: Node) => {
      if (
        isPropertyAssignment(node) &&
        isIdentifier(node.name) &&
        node.name.text === 'recommended' &&
        isStringLiteral(node.initializer)
      ) {
        changes.push({
          type: ChangeType.Delete,
          start: node.initializer.getStart(sourceFile),
          length: node.initializer.getWidth(sourceFile),
        });
        changes.push({
          type: ChangeType.Insert,
          index: node.initializer.getStart(sourceFile),
          text: "'recommended'",
        });
      } else {
        forEachChild(node, visit);
      }
    };

    forEachChild(sourceFile, visit);

    tree.write(path, applyChangesToString(contents, changes));
  });
}

export default async function update(tree: Tree) {
  updateJestConfig(tree);
  updateTsConfigs(tree);
  updateRecommended(tree);

  await formatFiles(tree);
}
