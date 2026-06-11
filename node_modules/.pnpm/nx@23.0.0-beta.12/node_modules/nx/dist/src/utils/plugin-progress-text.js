"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPluginProgressText = formatPluginProgressText;
function formatPluginProgressText(action, inProgressPlugins) {
    if (inProgressPlugins.size === 0) {
        return '';
    }
    if (inProgressPlugins.size === 1) {
        return `${action} with ${inProgressPlugins.values().next().value}`;
    }
    return [
        `${action} with ${inProgressPlugins.size} plugins`,
        ...Array.from(inProgressPlugins, (p) => `  - ${p}`),
    ].join('\n');
}
