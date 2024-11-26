import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
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
  return nxJsonMessage;
}

async function getJsonConfigLinesForErrorMessage(
  rawConfig: string,
  jsonPath: string[]
): Promise<{ startLine: number; endLine: number } | null> {
  try {
    const jsonParser = await import('jsonc-parser');
    const rootNode = jsonParser.parseTree(rawConfig);
    const node = jsonParser.findNodeAtLocation(rootNode, jsonPath);
    return computeJsonLineNumbers(rawConfig, node?.offset, node?.length);
  } catch {
    return null;
  }
}

function computeJsonLineNumbers(
  inputText: string,
  startOffset: number,
  characterCount: number
) {
  let lines = inputText.split('\n');
  let totalChars = 0;
  let startLine = 0;
  let endLine = 0;

  for (let i = 0; i < lines.length; i++) {
    totalChars += lines[i].length + 1; // +1 for '\n' character

    if (!startLine && totalChars >= startOffset) {
      startLine = i + 1; // +1 because arrays are 0-based
    }
    if (totalChars >= startOffset + characterCount) {
      endLine = i + 1; // +1 because arrays are 0-based
      break;
    }
  }

  if (!startLine) {
    throw new Error('Start offset exceeds the text length');
  }
  if (!endLine) {
    throw new Error(
      'Character count exceeds the text length after start offset'
    );
  }

  return { startLine, endLine };
}
