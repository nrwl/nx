/**
 * AI Agent NDJSON Output Utilities for nx import
 *
 * Extends the shared base with import-specific types and builders.
 */
import { writeAiOutput, logProgress, writeErrorLog, type DetectedPlugin, type UserNextSteps } from '../../ai/ai-output';
export { writeAiOutput, logProgress, writeErrorLog };
export type ImportProgressStage = 'starting' | 'cloning' | 'filtering' | 'merging' | 'detecting-plugins' | 'installing' | 'installing-plugins' | 'complete' | 'error' | 'needs_input';
export type NxImportErrorCode = 'UNCOMMITTED_CHANGES' | 'CLONE_FAILED' | 'SOURCE_NOT_FOUND' | 'DESTINATION_NOT_EMPTY' | 'INVALID_DESTINATION' | 'FILTER_FAILED' | 'MERGE_FAILED' | 'PACKAGE_INSTALL_ERROR' | 'PLUGIN_INIT_ERROR' | 'UNKNOWN';
interface ImportOptionInfo {
    description: string;
    flag: string;
    required: boolean;
}
export interface ImportNeedsOptionsResult {
    stage: 'needs_input';
    success: false;
    inputType: 'import_options';
    message: string;
    missingFields: string[];
    availableOptions: Record<string, ImportOptionInfo>;
    exampleCommand: string;
}
export interface ImportNeedsPluginSelectionResult {
    stage: 'needs_input';
    success: false;
    inputType: 'plugins';
    message: string;
    detectedPlugins: DetectedPlugin[];
    options: string[];
    recommendedOption: string;
    recommendedReason: string;
    exampleCommand: string;
    result: {
        sourceRepository: string;
        ref: string;
        source: string;
        destination: string;
    };
}
export interface ImportSuccessResult {
    stage: 'complete';
    success: true;
    result: {
        sourceRepository: string;
        ref: string;
        source: string;
        destination: string;
        pluginsInstalled: string[];
    };
    warnings?: ImportWarning[];
    userNextSteps: UserNextSteps;
    docs: {
        gettingStarted: string;
        nxImport: string;
    };
}
export interface ImportWarning {
    type: 'package_manager_mismatch' | 'config_path_mismatch' | 'missing_root_deps' | 'install_failed' | 'plugin_install_failed';
    message: string;
    hint: string;
}
export interface ImportErrorResult {
    stage: 'error';
    success: false;
    errorCode: NxImportErrorCode;
    error: string;
    hints: string[];
    errorLogPath?: string;
}
export type ImportAiOutputMessage = {
    stage: ImportProgressStage;
    message: string;
} | ImportNeedsOptionsResult | ImportNeedsPluginSelectionResult | ImportSuccessResult | ImportErrorResult;
export declare function buildImportNeedsOptionsResult(missingFields: string[], sourceRepository?: string): ImportNeedsOptionsResult;
export declare function buildImportNeedsPluginSelectionResult(options: {
    detectedPlugins: DetectedPlugin[];
    sourceRepository: string;
    ref: string;
    source: string;
    destination: string;
}): ImportNeedsPluginSelectionResult;
export declare function buildImportSuccessResult(options: {
    sourceRepository: string;
    ref: string;
    source: string;
    destination: string;
    pluginsInstalled: string[];
    warnings?: ImportWarning[];
}): ImportSuccessResult;
export declare function buildImportErrorResult(error: string, errorCode: NxImportErrorCode, errorLogPath?: string): ImportErrorResult;
export declare function getImportErrorHints(errorCode: NxImportErrorCode): string[];
export declare function determineImportErrorCode(error: Error | unknown): NxImportErrorCode;
