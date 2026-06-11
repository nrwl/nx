"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customDimensions = void 0;
exports.startAnalytics = startAnalytics;
exports.reportNxAddCommand = reportNxAddCommand;
exports.reportNxGenerateCommand = reportNxGenerateCommand;
exports.reportCommandRunEvent = reportCommandRunEvent;
exports.reportEvent = reportEvent;
exports.argsToQueryString = argsToQueryString;
exports.flushAnalytics = flushAnalytics;
const tslib_1 = require("tslib");
const nx_json_1 = require("../config/nx-json");
const workspace_root_1 = require("../utils/workspace-root");
const versions_1 = require("../utils/versions");
const native_1 = require("../native");
const package_manager_1 = require("../utils/package-manager");
const semver_1 = require("semver");
const os = tslib_1.__importStar(require("os"));
const crypto_1 = require("crypto");
const machine_id_cache_1 = require("../utils/machine-id-cache");
const is_ci_1 = require("../utils/is-ci");
const analytics_prompt_1 = require("../utils/analytics-prompt");
const db_connection_1 = require("../utils/db-connection");
// Conditionally import telemetry functions only on non-WASM platforms
let initializeTelemetry;
let initializeTelemetryWithSessionId;
let flushTelemetry;
let trackEventNative;
let trackPageViewNative;
let getEventDimensions;
if (!native_1.IS_WASM) {
    const nativeModule = require('../native');
    initializeTelemetry = nativeModule.initializeTelemetry;
    initializeTelemetryWithSessionId =
        nativeModule.initializeTelemetryWithSessionId;
    flushTelemetry = nativeModule.flushTelemetry;
    trackEventNative = nativeModule.trackEvent;
    trackPageViewNative = nativeModule.trackPageView;
    getEventDimensions = nativeModule.getEventDimensions;
}
exports.customDimensions = native_1.IS_WASM
    ? null
    : (getEventDimensions?.() ?? null);
let _telemetryInitialized = false;
async function startAnalytics() {
    // Analytics not supported on WASM
    if (native_1.IS_WASM) {
        return;
    }
    if (!isAnalyticsEnabled()) {
        return;
    }
    const nxJson = (0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot);
    const workspaceId = (0, analytics_prompt_1.generateWorkspaceId)();
    if (!workspaceId) {
        // Not a git repo — no telemetry
        return;
    }
    const isNxCloud = !!(nxJson?.nxCloudId ?? nxJson?.nxCloudAccessToken);
    const userId = await getTelemetryUserId(workspaceId);
    const packageManagerInfo = getPackageManagerInfo();
    const nodeVersion = (0, semver_1.parse)(process.version);
    const nodeVersionString = nodeVersion
        ? `${nodeVersion.major}.${nodeVersion.minor}.${nodeVersion.patch}`
        : 'unknown';
    const commonArgs = [
        workspaceId,
        userId,
        versions_1.nxVersion,
        packageManagerInfo.name,
        packageManagerInfo.version,
        nodeVersionString,
        os.arch(),
        os.platform(),
        os.release(),
        !!(0, is_ci_1.isCI)(),
        isNxCloud,
    ];
    try {
        const sessionId = process.env.NX_ANALYTICS_SESSION_ID;
        if (sessionId) {
            // Plugin worker path — reuse session ID from parent, no DB needed
            initializeTelemetryWithSessionId(sessionId, ...commonArgs);
        }
        else {
            // CLI/daemon path — get session from DB, set env var for children
            const dbConnection = (0, db_connection_1.getDbConnection)();
            const newSessionId = initializeTelemetry(dbConnection, ...commonArgs);
            process.env.NX_ANALYTICS_SESSION_ID = newSessionId;
        }
        _telemetryInitialized = true;
        // Flush analytics automatically on process exit so every code path
        // is covered without needing explicit exitAndFlushAnalytics() calls.
        process.on('exit', () => {
            flushAnalytics();
        });
    }
    catch (error) {
        // If telemetry service fails to initialize, continue without it
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            console.log(`Failed to initialize telemetry: ${error.message}`);
        }
    }
}
function reportNxAddCommand(packageName, version) {
    reportCommandRunEvent('add', {
        [exports.customDimensions.packageName]: packageName,
        [exports.customDimensions.packageVersion]: version,
    });
}
function reportNxGenerateCommand(generator) {
    reportCommandRunEvent('generate', {
        [exports.customDimensions.generatorName]: generator,
    });
}
function reportCommandRunEvent(command, parameters, args) {
    command = command === 'g' ? 'generate' : command;
    let pageLocation = command;
    if (args) {
        const qs = argsToQueryString(args);
        if (qs) {
            pageLocation = `${command}?${qs}`;
        }
    }
    trackPageView(command, pageLocation, parameters);
}
function reportEvent(name, eventParameters) {
    trackEvent(name, eventParameters);
}
const SKIP_ARGS_KEYS = new Set([
    '$0',
    '_',
    '__overrides_unparsed__',
    '__overrides__',
]);
// String args with fixed enum values that are safe to include in analytics.
// All boolean and number args are included automatically.
const ALLOWED_STRING_ARGS = new Set([
    'outputStyle',
    'type',
    'view',
    'access',
    'preset',
    'interactive',
    'printConfig',
    'resolveVersionPlans',
]);
function argsToQueryString(args) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
        if (SKIP_ARGS_KEYS.has(key))
            continue;
        if (value === undefined || value === null)
            continue;
        if (typeof value === 'boolean' || typeof value === 'number') {
            params.append(key, String(value));
        }
        else if (typeof value === 'string' && ALLOWED_STRING_ARGS.has(key)) {
            params.append(key, value);
        }
        // All other types (strings, arrays, objects) are dropped
    }
    return params.toString();
}
function trackEvent(eventName, parameters) {
    if (_telemetryInitialized) {
        // Convert parameters to string map for Rust
        const stringParams = {};
        if (parameters) {
            for (const [key, value] of Object.entries(parameters)) {
                if (value !== undefined && value !== null) {
                    stringParams[key] = String(value);
                }
            }
        }
        // Fire and forget - synchronous call
        try {
            trackEventNative(eventName, stringParams);
        }
        catch {
            // Silently ignore errors
        }
    }
}
function trackPageView(pageTitle, pageLocation, parameters) {
    if (_telemetryInitialized) {
        // Convert parameters to string map for Rust
        const stringParams = {};
        if (parameters) {
            for (const [key, value] of Object.entries(parameters)) {
                if (value !== undefined && value !== null) {
                    stringParams[key] = String(value);
                }
            }
        }
        // Fire and forget - synchronous call
        try {
            trackPageViewNative(pageTitle, pageLocation, stringParams);
        }
        catch {
            // Silently ignore errors
        }
    }
}
function flushAnalytics() {
    if (_telemetryInitialized) {
        try {
            flushTelemetry();
        }
        catch (error) {
            // Failure to report analytics shouldn't crash the CLI
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.log(`Failed to flush telemetry: ${error.message}`);
            }
        }
    }
}
function getPackageManagerInfo() {
    const pm = (0, package_manager_1.detectPackageManager)();
    return {
        name: pm,
        version: (0, package_manager_1.getPackageManagerVersion)(pm),
    };
}
function isAnalyticsEnabled() {
    const nxJson = (0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot);
    return nxJson?.analytics === true;
}
// Mix workspace id in: shared Docker images (Gitpod, Cypress, etc.) bake
// in /etc/machine-id, so machine-id alone collapses many users into one.
async function getTelemetryUserId(workspaceId) {
    const machineId = await (0, machine_id_cache_1.getCurrentMachineId)();
    return (0, crypto_1.createHash)('sha256')
        .update(`${machineId}|${workspaceId}`)
        .digest('hex');
}
