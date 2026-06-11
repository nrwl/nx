"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineAiAgents = determineAiAgents;
const tslib_1 = require("tslib");
const enquirer_1 = require("enquirer");
const is_ci_1 = require("../../utils/is-ci");
const utils_1 = require("../../ai/utils");
const detect_ai_agent_1 = require("../../ai/detect-ai-agent");
const pc = tslib_1.__importStar(require("picocolors"));
async function determineAiAgents(aiAgents, interactive) {
    if (interactive === false || (0, is_ci_1.isCI)()) {
        if (aiAgents) {
            return aiAgents;
        }
        const detected = (0, detect_ai_agent_1.detectAiAgent)();
        return detected ? [detected] : [];
    }
    if (aiAgents) {
        return aiAgents;
    }
    return await aiAgentsPrompt();
}
async function aiAgentsPrompt() {
    const promptConfig = {
        name: 'agents',
        message: 'Which AI agents, if any, would you like to set up?',
        type: 'multiselect',
        choices: utils_1.supportedAgents.map((a) => ({
            name: a,
            message: utils_1.agentDisplayMap[a],
        })),
        footer: () => pc.dim('Multiple selections possible. <Space> to select. <Enter> to confirm.'),
    };
    return (await (0, enquirer_1.prompt)([promptConfig])).agents;
}
