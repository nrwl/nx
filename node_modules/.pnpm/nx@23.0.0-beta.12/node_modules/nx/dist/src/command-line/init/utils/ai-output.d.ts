/**
 * AI Agent NDJSON Output Utilities for nx init
 *
 * Extends the shared base with init-specific types and builders.
 *
 * NOTE: This is intentionally duplicated from create-nx-workspace.
 * CNW is self-contained and cannot import from the nx package.
 */
import { writeAiOutput, logProgress, writeErrorLog, type ProgressMessage, type DetectedPlugin, type NextStep, type UserNextSteps, type PluginWarning, type BaseProgressStage } from '../../ai/ai-output';
export { writeAiOutput, logProgress, writeErrorLog };
export type { ProgressMessage, DetectedPlugin, NextStep, UserNextSteps, PluginWarning, BaseProgressStage, };
export type ProgressStage = 'starting' | 'detecting' | 'configuring' | 'installing' | 'plugins' | 'complete' | 'error' | 'needs_input';
export type NxInitErrorCode = 'ALREADY_INITIALIZED' | 'PACKAGE_INSTALL_ERROR' | 'UNCOMMITTED_CHANGES' | 'UNSUPPORTED_PROJECT' | 'PLUGIN_INIT_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
export interface NeedsInputResult {
    stage: 'needs_input';
    success: false;
    inputType: 'plugins';
    message: string;
    detectedPlugins: DetectedPlugin[];
    options: string[];
    recommendedOption: string;
    recommendedReason: string;
    exampleCommand: string;
}
export interface SuccessResult {
    stage: 'complete';
    success: true;
    result: {
        nxVersion: string;
        pluginsInstalled: string[];
    };
    warnings?: PluginWarning[];
    userNextSteps: UserNextSteps;
    docs: {
        gettingStarted: string;
        nxCloud: string;
    };
}
export interface ErrorResult {
    stage: 'error';
    success: false;
    errorCode: NxInitErrorCode;
    error: string;
    hints: string[];
    errorLogPath?: string;
}
export type AiOutputMessage = ProgressMessage | NeedsInputResult | SuccessResult | ErrorResult;
/**
 * Build needs_input result for plugin selection.
 * This tells the AI which plugins are available and how to proceed.
 */
export declare function buildNeedsInputResult(detectedPlugins: DetectedPlugin[]): NeedsInputResult;
/**
 * Build success result object with next steps.
 */
export declare function buildSuccessResult(options: {
    nxVersion: string;
    pluginsInstalled: string[];
    warnings?: PluginWarning[];
}): SuccessResult;
/**
 * Build error result object with helpful hints.
 */
export declare function buildErrorResult(error: string, errorCode: NxInitErrorCode, errorLogPath?: string): ErrorResult;
/**
 * Get helpful hints based on error code.
 */
export declare function getErrorHints(errorCode: NxInitErrorCode): string[];
/**
 * Determine error code from an error object.
 */
export declare function determineErrorCode(error: Error | unknown): NxInitErrorCode;
