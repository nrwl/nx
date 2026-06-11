"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nxMcpTomlHeader = exports.getAgentRulesWrapped = exports.rulesRegex = exports.nxRulesMarkerCommentEnd = exports.nxRulesMarkerCommentDescription = exports.nxRulesMarkerCommentStart = void 0;
exports.agentsMdPath = agentsMdPath;
exports.geminiMdPath = geminiMdPath;
exports.parseGeminiSettings = parseGeminiSettings;
exports.geminiSettingsPath = geminiSettingsPath;
exports.claudeMdPath = claudeMdPath;
exports.claudeMcpJsonPath = claudeMcpJsonPath;
exports.opencodeMcpPath = opencodeMcpPath;
exports.codexConfigTomlPath = codexConfigTomlPath;
exports.getNxMcpTomlConfig = getNxMcpTomlConfig;
const path_1 = require("path");
const semver_1 = require("semver");
const fileutils_1 = require("../utils/fileutils");
const get_agent_rules_1 = require("./set-up-ai-agents/get-agent-rules");
function agentsMdPath(root) {
    return (0, path_1.join)(root, 'AGENTS.md');
}
function geminiMdPath(root) {
    return (0, path_1.join)(root, 'GEMINI.md');
}
function parseGeminiSettings(root) {
    const settingsPath = geminiSettingsPath(root);
    try {
        return (0, fileutils_1.readJsonFile)(settingsPath);
    }
    catch {
        return undefined;
    }
}
function geminiSettingsPath(root) {
    return (0, path_1.join)(root, '.gemini', 'settings.json');
}
function claudeMdPath(root) {
    return (0, path_1.join)(root, 'CLAUDE.md');
}
function claudeMcpJsonPath(root) {
    return (0, path_1.join)(root, '.mcp.json');
}
function opencodeMcpPath(root) {
    return (0, path_1.join)(root, 'opencode.json');
}
function codexConfigTomlPath(root) {
    return (0, path_1.join)(root, '.codex', 'config.toml');
}
exports.nxRulesMarkerCommentStart = `<!-- nx configuration start-->`;
exports.nxRulesMarkerCommentDescription = `<!-- Leave the start & end comments to automatically receive updates. -->`;
exports.nxRulesMarkerCommentEnd = `<!-- nx configuration end-->`;
exports.rulesRegex = new RegExp(`${exports.nxRulesMarkerCommentStart}[\\s\\S]*?${exports.nxRulesMarkerCommentEnd}`, 'm');
const getAgentRulesWrapped = (options) => {
    const { writeNxCloudRules, useH1 = true } = options;
    const agentRulesString = (0, get_agent_rules_1.getAgentRules)({ nxCloud: writeNxCloudRules, useH1 });
    return `${exports.nxRulesMarkerCommentStart}\n${exports.nxRulesMarkerCommentDescription}\n\n${agentRulesString}\n\n${exports.nxRulesMarkerCommentEnd}`;
};
exports.getAgentRulesWrapped = getAgentRulesWrapped;
exports.nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;
/**
 * Get the MCP TOML configuration based on the Nx version.
 * For Nx 22+, uses 'nx mcp'
 * For Nx < 22, uses 'nx-mcp'
 */
function getNxMcpTomlConfig(nxVersion) {
    const majorVersion = (0, semver_1.major)(nxVersion);
    const args = majorVersion >= 22 ? '["nx", "mcp"]' : '["nx-mcp"]';
    return `${exports.nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ${args}
`;
}
