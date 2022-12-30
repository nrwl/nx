import type { SourceFile } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

export function checkOutputNameMatchesProjectName(
  ast: SourceFile,
  projectName: string
) {
  const OUTPUT_SELECTOR =
    'PropertyAssignment:has(Identifier[name=output]) > ObjectLiteralExpression:has(PropertyAssignment:has(Identifier[name=uniqueName]))';
  const UNIQUENAME_SELECTOR =
    'ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=uniqueName]) > StringLiteral';

  const outputNodes = tsquery(ast, OUTPUT_SELECTOR, { visitAllChildren: true });
  if (outputNodes.length === 0) {
    // If the output isnt set in the config, then we can still set the project name correctly
    return true;
  }

  const uniqueNameNodes = tsquery(outputNodes[0], UNIQUENAME_SELECTOR, {
    visitAllChildren: true,
  });
  if (uniqueNameNodes.length === 0) {
    // If the uniqeName isnt set in the config, then we can still set the project name correctly
    return true;
  }
  const uniqueName = uniqueNameNodes[0].getText().replace(/'/g, '');

  return uniqueName === projectName;
}
