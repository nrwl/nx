"use strict";
/**
 * AI Agent NDJSON Output Utilities for nx init
 *
 * Extends the shared base with init-specific types and builders.
 *
 * NOTE: This is intentionally duplicated from create-nx-workspace.
 * CNW is self-contained and cannot import from the nx package.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeErrorLog = exports.logProgress = exports.writeAiOutput = void 0;
exports.buildNeedsInputResult = buildNeedsInputResult;
exports.buildSuccessResult = buildSuccessResult;
exports.buildErrorResult = buildErrorResult;
exports.getErrorHints = getErrorHints;
exports.determineErrorCode = determineErrorCode;
// Import shared base types and utilities
const ai_output_1 = require("../../ai/ai-output");
Object.defineProperty(exports, "writeAiOutput", { enumerable: true, get: function () { return ai_output_1.writeAiOutput; } });
Object.defineProperty(exports, "logProgress", { enumerable: true, get: function () { return ai_output_1.logProgress; } });
Object.defineProperty(exports, "writeErrorLog", { enumerable: true, get: function () { return ai_output_1.writeErrorLog; } });
/**
 * Build needs_input result for plugin selection.
 * This tells the AI which plugins are available and how to proceed.
 */
function buildNeedsInputResult(detectedPlugins) {
    const pluginList = detectedPlugins.map((p) => p.name).join(',');
    return {
        stage: 'needs_input',
        success: false,
        inputType: 'plugins',
        message: 'Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.',
        detectedPlugins,
        options: ['--plugins=skip', '--plugins=all', `--plugins=${pluginList}`],
        recommendedOption: '--plugins=skip',
        recommendedReason: 'Plugins can be added later with nx add.',
        exampleCommand: `nx init --plugins=${detectedPlugins[0]?.name || '@nx/vite'}`,
    };
}
/**
 * Build success result object with next steps.
 */
function buildSuccessResult(options) {
    const { nxVersion, pluginsInstalled, warnings } = options;
    // Build user-facing next steps
    const steps = [
        {
            title: 'Explore your workspace',
            command: 'nx graph',
            note: 'Visualize project dependencies',
        },
        {
            title: 'List projects and details',
            command: 'nx show projects',
            note: 'Or nx show project <project-name> to see targets and configuration',
        },
        {
            title: 'Run a task',
            command: 'nx run <project>:<script>',
            note: 'Run any script from a project package.json (e.g., nx run client:build)',
        },
        {
            title: 'Enable Remote Caching',
            command: 'nx connect',
            note: 'Speed up CI by 30-70% with Nx Cloud',
        },
    ];
    const successResult = {
        stage: 'complete',
        success: true,
        result: {
            nxVersion,
            pluginsInstalled,
        },
        userNextSteps: {
            description: 'Show user these steps to complete setup.',
            steps,
        },
        docs: {
            gettingStarted: 'https://nx.dev/getting-started/intro',
            nxCloud: 'https://nx.dev/ci/intro/why-nx-cloud',
        },
    };
    if (warnings && warnings.length > 0) {
        successResult.warnings = warnings;
    }
    return successResult;
}
/**
 * Build error result object with helpful hints.
 */
function buildErrorResult(error, errorCode, errorLogPath) {
    const hints = getErrorHints(errorCode);
    return {
        stage: 'error',
        success: false,
        errorCode,
        error,
        hints,
        errorLogPath,
    };
}
/**
 * Get helpful hints based on error code.
 */
function getErrorHints(errorCode) {
    switch (errorCode) {
        case 'ALREADY_INITIALIZED':
            return [
                'Workspace already has nx.json',
                'Remove nx.json to reinitialize',
                'Use nx add to add plugins to existing workspace',
            ];
        case 'PACKAGE_INSTALL_ERROR':
            return [
                'Check your package manager is installed correctly',
                'Try clearing npm/yarn/pnpm cache',
                'Check for conflicting global packages',
            ];
        case 'UNCOMMITTED_CHANGES':
            return [
                'Commit or stash your changes before running nx init',
                'Use --force to skip this check (not recommended)',
            ];
        case 'UNSUPPORTED_PROJECT':
            return [
                'Project type could not be detected',
                'Ensure you are in a valid project directory',
                'Check https://nx.dev/getting-started for supported project types',
            ];
        case 'PLUGIN_INIT_ERROR':
            return [
                'One or more plugin init generators failed',
                'Check the error log for details',
                "Try running 'nx add <plugin>' manually",
            ];
        case 'NETWORK_ERROR':
            return [
                'Check your internet connection',
                'Try again in a few moments',
                'Check if npm registry is accessible',
            ];
        default:
            return [
                'An unexpected error occurred',
                'Check the error log for details',
                'Report issues at https://github.com/nrwl/nx/issues',
            ];
    }
}
/**
 * Determine error code from an error object.
 */
function determineErrorCode(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('nx.json already exists') ||
        lowerMessage.includes('already initialized')) {
        return 'ALREADY_INITIALIZED';
    }
    if (lowerMessage.includes('install') ||
        lowerMessage.includes('npm') ||
        lowerMessage.includes('yarn') ||
        lowerMessage.includes('pnpm')) {
        return 'PACKAGE_INSTALL_ERROR';
    }
    if (lowerMessage.includes('uncommitted') ||
        lowerMessage.includes('git status')) {
        return 'UNCOMMITTED_CHANGES';
    }
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('enotfound') ||
        lowerMessage.includes('etimedout')) {
        return 'NETWORK_ERROR';
    }
    if (lowerMessage.includes('plugin') || lowerMessage.includes('generator')) {
        return 'PLUGIN_INIT_ERROR';
    }
    return 'UNKNOWN';
}
