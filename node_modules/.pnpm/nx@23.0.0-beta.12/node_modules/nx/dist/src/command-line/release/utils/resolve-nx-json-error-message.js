"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNxJsonConfigErrorMessage = resolveNxJsonConfigErrorMessage;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const handle_import_1 = require("../../../utils/handle-import");
const path_1 = require("../../../utils/path");
const workspace_root_1 = require("../../../utils/workspace-root");
async function resolveNxJsonConfigErrorMessage(propPath) {
    const errorLines = await getJsonConfigLinesForErrorMessage((0, node_fs_1.readFileSync)((0, path_1.joinPathFragments)(workspace_root_1.workspaceRoot, 'nx.json'), 'utf-8'), propPath);
    let nxJsonMessage = `The relevant config is defined here: ${(0, node_path_1.relative)(process.cwd(), (0, path_1.joinPathFragments)(workspace_root_1.workspaceRoot, 'nx.json'))}`;
    if (errorLines) {
        nxJsonMessage +=
            errorLines.startLine === errorLines.endLine
                ? `, line ${errorLines.startLine}`
                : `, lines ${errorLines.startLine}-${errorLines.endLine}`;
    }
    return nxJsonMessage + '.';
}
async function getJsonConfigLinesForErrorMessage(rawConfig, jsonPath) {
    try {
        const jsonParser = await (0, handle_import_1.handleImport)('jsonc-parser');
        const rootNode = jsonParser.parseTree(rawConfig);
        const node = jsonParser.findNodeAtLocation(rootNode, jsonPath);
        return computeJsonLineNumbers(rawConfig, node?.offset, node?.length);
    }
    catch {
        return null;
    }
}
function computeJsonLineNumbers(inputText, startOffset, characterCount) {
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
        throw new Error('Character count exceeds the text length after start offset');
    }
    return { startLine, endLine };
}
