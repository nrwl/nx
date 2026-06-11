"use strict";
/**
 * AI Agent NDJSON Output Utilities for nx import
 *
 * Extends the shared base with import-specific types and builders.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeErrorLog = exports.logProgress = exports.writeAiOutput = void 0;
exports.buildImportNeedsOptionsResult = buildImportNeedsOptionsResult;
exports.buildImportNeedsPluginSelectionResult = buildImportNeedsPluginSelectionResult;
exports.buildImportSuccessResult = buildImportSuccessResult;
exports.buildImportErrorResult = buildImportErrorResult;
exports.getImportErrorHints = getImportErrorHints;
exports.determineImportErrorCode = determineImportErrorCode;
const ai_output_1 = require("../../ai/ai-output");
Object.defineProperty(exports, "writeAiOutput", { enumerable: true, get: function () { return ai_output_1.writeAiOutput; } });
Object.defineProperty(exports, "logProgress", { enumerable: true, get: function () { return ai_output_1.logProgress; } });
Object.defineProperty(exports, "writeErrorLog", { enumerable: true, get: function () { return ai_output_1.writeErrorLog; } });
const AVAILABLE_OPTIONS = {
    sourceRepository: {
        description: 'URL or path of the repository to import.',
        flag: '--sourceRepository',
        required: true,
    },
    ref: {
        description: 'Branch to import from the source repository.',
        flag: '--ref',
        required: true,
    },
    source: {
        description: 'Directory within the source repo to import (blank = entire repo).',
        flag: '--source',
        required: false,
    },
    destination: {
        description: 'Target directory in this workspace to import into.',
        flag: '--destination',
        required: true,
    },
};
function buildImportNeedsOptionsResult(missingFields, sourceRepository) {
    const exampleRepo = sourceRepository || 'https://github.com/org/repo';
    return {
        stage: 'needs_input',
        success: false,
        inputType: 'import_options',
        message: 'Required options missing. Re-invoke with the listed flags.',
        missingFields,
        availableOptions: AVAILABLE_OPTIONS,
        exampleCommand: `nx import ${exampleRepo} --ref=main --source=apps/my-app --destination=apps/my-app`,
    };
}
function buildImportNeedsPluginSelectionResult(options) {
    const pluginList = options.detectedPlugins.map((p) => p.name).join(',');
    return {
        stage: 'needs_input',
        success: false,
        inputType: 'plugins',
        message: 'Import complete. Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.',
        detectedPlugins: options.detectedPlugins,
        options: ['--plugins=skip', '--plugins=all', `--plugins=${pluginList}`],
        recommendedOption: '--plugins=all',
        recommendedReason: 'Installing all detected plugins ensures the imported project works correctly with Nx.',
        exampleCommand: `nx import ${options.sourceRepository} ${options.destination} --ref=${options.ref} --source=${options.source} --plugins=${options.detectedPlugins[0]?.name || '@nx/vite'}`,
        result: {
            sourceRepository: options.sourceRepository,
            ref: options.ref,
            source: options.source,
            destination: options.destination,
        },
    };
}
function buildImportSuccessResult(options) {
    const steps = [
        {
            title: 'Explore your workspace',
            command: 'nx graph',
            note: 'Visualize project dependencies including imported projects',
        },
        {
            title: 'List imported projects',
            command: 'nx show projects',
            note: 'Verify the imported projects appear in the workspace',
        },
        {
            title: 'Run a task on imported code',
            command: `nx run <project>:<target>`,
            note: 'Test that imported projects build and run correctly',
        },
    ];
    const result = {
        stage: 'complete',
        success: true,
        result: {
            sourceRepository: options.sourceRepository,
            ref: options.ref,
            source: options.source,
            destination: options.destination,
            pluginsInstalled: options.pluginsInstalled,
        },
        userNextSteps: {
            description: 'Show user these steps to verify the import.',
            steps,
        },
        docs: {
            gettingStarted: 'https://nx.dev/getting-started/intro',
            nxImport: 'https://nx.dev/nx-api/nx/documents/import',
        },
    };
    if (options.warnings && options.warnings.length > 0) {
        result.warnings = options.warnings;
    }
    return result;
}
function buildImportErrorResult(error, errorCode, errorLogPath) {
    return {
        stage: 'error',
        success: false,
        errorCode,
        error,
        hints: getImportErrorHints(errorCode),
        errorLogPath,
    };
}
function getImportErrorHints(errorCode) {
    switch (errorCode) {
        case 'UNCOMMITTED_CHANGES':
            return [
                'Commit or stash your changes before running nx import',
                'Run "git status" to see uncommitted changes',
            ];
        case 'CLONE_FAILED':
            return [
                'Check the repository URL is correct and accessible',
                'Ensure you have the necessary permissions to clone',
                'For local paths, verify the directory exists',
            ];
        case 'SOURCE_NOT_FOUND':
            return [
                'The specified source directory does not exist in the source repository',
                'Check the directory path and branch name',
                'Omit --source to import the entire repository',
            ];
        case 'DESTINATION_NOT_EMPTY':
            return [
                'The destination directory already contains files',
                'Choose a different destination or remove existing files',
            ];
        case 'INVALID_DESTINATION':
            return [
                'The destination must be a relative path within the workspace',
                'Do not use absolute paths',
            ];
        case 'FILTER_FAILED':
            return [
                'Git history filtering failed',
                'Install git-filter-repo for faster and more reliable filtering: pip install git-filter-repo',
                'Check that the source repository has valid git history',
            ];
        case 'MERGE_FAILED':
            return [
                'Merging the imported code failed',
                'Check for conflicts between source and destination',
                'Run "git status" to see the current state',
            ];
        case 'PACKAGE_INSTALL_ERROR':
            return [
                'Package installation failed after import',
                'Run your package manager install manually',
                'Check for dependency conflicts between imported and existing packages',
            ];
        case 'PLUGIN_INIT_ERROR':
            return [
                'One or more plugin initializations failed',
                'Try running "nx add <plugin>" manually',
            ];
        default:
            return [
                'An unexpected error occurred during import',
                'Check the error log for details',
                'Report issues at https://github.com/nrwl/nx/issues',
            ];
    }
}
function determineImportErrorCode(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes('uncommitted'))
        return 'UNCOMMITTED_CHANGES';
    if (lower.includes('failed to clone'))
        return 'CLONE_FAILED';
    if (lower.includes('does not exist in'))
        return 'SOURCE_NOT_FOUND';
    if (lower.includes('is not empty') || lower.includes('destination directory'))
        return 'DESTINATION_NOT_EMPTY';
    if (lower.includes('must be a relative path'))
        return 'INVALID_DESTINATION';
    if (lower.includes('filter-repo') ||
        lower.includes('filter-branch') ||
        lower.includes('filter'))
        return 'FILTER_FAILED';
    if (lower.includes('merge'))
        return 'MERGE_FAILED';
    if (lower.includes('install'))
        return 'PACKAGE_INSTALL_ERROR';
    if (lower.includes('plugin') || lower.includes('generator'))
        return 'PLUGIN_INIT_ERROR';
    return 'UNKNOWN';
}
