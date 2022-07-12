import { formatFiles, Tree, visitNotIgnoredFiles } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

function updateFile(fileAst: any, fileContents: string): string {
  const importStatement: any[] = tsquery(
    fileAst,
    'ImportDeclaration StringLiteral[value=@typescript-eslint/experimental-utils]'
  );
  if (importStatement.length === 0) {
    return;
  }
  const updatedContents = fileContents.split(
    '@typescript-eslint/experimental-utils'
  );
  return `${updatedContents[0]}@typescript-eslint/utils${updatedContents[1]}`;
}

export default async function experimentalToUtilsUpdate(tree: Tree) {
  try {
    visitNotIgnoredFiles(tree, 'tools/eslint-rules', (path) => {
      if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
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

        tree.write(path, updateFile(fileAst, fileContents));
      }

      if (path.endsWith('.spec.ts')) {
        const fileContents = tree.read(path).toString('utf-8');
        const fileAst = tsquery.ast(fileContents);

        const isESLintSpecRuleFile =
          tsquery(
            fileAst,
            'PropertyAccessExpression[name.escapedText=RuleTester]'
          ).length > 0;
        if (!isESLintSpecRuleFile) {
          return;
        }

        tree.write(path, updateFile(fileAst, fileContents));
      }
    });

    await formatFiles(tree);
  } catch {}
}
