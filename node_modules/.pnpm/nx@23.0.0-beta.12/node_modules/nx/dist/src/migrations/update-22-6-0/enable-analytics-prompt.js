"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = enableAnalyticsPrompt;
const nx_json_1 = require("../../generators/utils/nx-json");
const is_ci_1 = require("../../utils/is-ci");
const analytics_prompt_1 = require("../../utils/analytics-prompt");
async function enableAnalyticsPrompt(tree) {
    const nxJson = (0, nx_json_1.readNxJson)(tree);
    if (!nxJson) {
        return;
    }
    // Already configured
    if (typeof nxJson.analytics === 'boolean') {
        return;
    }
    // Can't prompt in CI or non-interactive terminals
    if ((0, is_ci_1.isCI)() || !process.stdin.isTTY || !process.stdout.isTTY) {
        return;
    }
    const enabled = await (0, analytics_prompt_1.promptForAnalyticsPreference)();
    nxJson.analytics = enabled;
    (0, nx_json_1.updateNxJson)(tree, nxJson);
}
