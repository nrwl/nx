import type { SourceFile } from 'typescript';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

export function checkOutputNameMatchesProjectName(
  sourceFile: SourceFile,
  projectName: string
) {
  ensureTypescript();
  const { query } = require('@phenomnomnominal/tsquery');
  const OUTPUT_SELECTOR =
    'PropertyAssignment:has(Identifier[name=output]) > ObjectLiteralExpression:has(PropertyAssignment:has(Identifier[name=uniqueName]))';
  const UNIQUENAME_SELECTOR =
    'ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=uniqueName]) > StringLiteral';

  const outputNodes = query(sourceFile, OUTPUT_SELECTOR);
  if (outputNodes.length === 0) {
    // If the output isnt set in the config, then we can still set the project name correctly
    return true;
  }

  const uniqueNameNodes = query(outputNodes[0], UNIQUENAME_SELECTOR);
  if (uniqueNameNodes.length === 0) {
    // If the uniqeName isnt set in the config, then we can still set the project name correctly
    return true;
  }
  const uniqueName = uniqueNameNodes[0].getText().replace(/'/g, '');

  return uniqueName === projectName;
}
