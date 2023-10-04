import { formatFiles, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

function updateFile(fileAst: any, fileContents: string): string | undefined {
  const importStatement: any[] = tsquery(
    fileAst,
    'ImportDeclaration StringLiteral[value=@typescript-eslint/experimental-utils]'
  );
  if (importStatement.length === 0) {
    return;
  }
  const contentSlices = fileContents.split(
    '@typescript-eslint/experimental-utils'
  );
  let updatedFileContents = '';
  for (let i = 0; i < contentSlices.length / 2; i++) {
    updatedFileContents += `${contentSlices[i]}@typescript-eslint/utils`;
  }
  updatedFileContents += contentSlices[contentSlices.length - 1];
  return updatedFileContents;
}

export default async function experimentalToUtilsUpdate(tree: Tree) {
  try {
    visitNotIgnoredFiles(tree, 'tools/eslint-rules', (path) => {
      if (path.endsWith('.ts')) {
        const fileContents = tree.read(path).toString('utf-8');
        const fileAst = tsquery.ast(fileContents);

        const updatedContents = updateFile(fileAst, fileContents);
        if (updatedContents) {
          tree.write(path, updatedContents);
        }
      }
    });

    await formatFiles(tree);
  } catch {}
}
