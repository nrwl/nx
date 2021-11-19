import {
  formatFiles,
  normalizePath,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { addPropertyToJestConfig } from '@nrwl/jest';
import { tsquery } from '@phenomnomnominal/tsquery';

export default async function eslint8Updates(tree: Tree) {
  try {
    const existingJestConfigPath = normalizePath(
      'tools/eslint-rules/jest.config.js'
    );

    // Add extra config to the jest.config.js file to allow ESLint 8 exports mapping to work with jest
    addPropertyToJestConfig(tree, existingJestConfigPath, 'moduleNameMapper', {
      '@eslint/eslintrc': '@eslint/eslintrc/dist/eslintrc-universal.cjs',
    });

    visitNotIgnoredFiles(tree, 'tools/eslint-rules', (path) => {
      if (!path.endsWith('.ts')) {
        return;
      }
      const fileContents = tree.read(path).toString('utf-8');
      const fileAst = tsquery.ast(fileContents);
      const isESLintRuleFile =
        tsquery(
          fileAst,
          'PropertyAccessExpression[expression.escapedText=ESLintUtils][name.escapedText=RuleCreator]'
        ).length > 0;
      if (!isESLintRuleFile) {
        return;
      }
      const categoryPropertyAssignmentNode = tsquery(
        fileAst,
        'PropertyAssignment[name.escapedText=category]'
      )[0];
      if (!categoryPropertyAssignmentNode) {
        return;
      }
      let end = categoryPropertyAssignmentNode.getEnd();
      if (fileContents.substring(end, end + 1) === ',') {
        end++;
      }
      const updatedContents =
        fileContents.slice(0, categoryPropertyAssignmentNode.getFullStart()) +
        fileContents.slice(end);
      tree.write(path, updatedContents);
    });

    await formatFiles(tree);
  } catch {}
}
