import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { handleImport } from '../../../utils/handle-import';
import { computeJsonLineNumbers } from '../../../utils/json';
import { joinPathFragments } from '../../../utils/path';
import { workspaceRoot } from '../../../utils/workspace-root';

export async function resolveNxJsonConfigErrorMessage(
  propPath: string[]
): Promise<string> {
  const errorLines = await getJsonConfigLinesForErrorMessage(
    readFileSync(joinPathFragments(workspaceRoot, 'nx.json'), 'utf-8'),
    propPath
  );
  let nxJsonMessage = `The relevant config is defined here: ${relative(
    process.cwd(),
    joinPathFragments(workspaceRoot, 'nx.json')
  )}`;
  if (errorLines) {
    nxJsonMessage +=
      errorLines.startLine === errorLines.endLine
        ? `, line ${errorLines.startLine}`
        : `, lines ${errorLines.startLine}-${errorLines.endLine}`;
  }
  return nxJsonMessage + '.';
}

async function getJsonConfigLinesForErrorMessage(
  rawConfig: string,
  jsonPath: string[]
): Promise<{ startLine: number; endLine: number } | null> {
  try {
    const jsonParser = await handleImport('jsonc-parser');
    const rootNode = jsonParser.parseTree(rawConfig);
    const node = jsonParser.findNodeAtLocation(rootNode, jsonPath);
    return computeJsonLineNumbers(rawConfig, node?.offset, node?.length);
  } catch {
    return null;
  }
}
