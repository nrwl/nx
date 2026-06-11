/**
 * Shared AI Agent NDJSON Output Utilities
 *
 * Base types and utilities for AI agent output across all Nx commands.
 * Each command extends with its own specific progress stages, error codes, and result types.
 */
export type BaseProgressStage = 'starting' | 'complete' | 'error' | 'needs_input';
export interface ProgressMessage {
    stage: string;
    message: string;
}
export interface DetectedPlugin {
    name: string;
    reason: string;
}
export interface NextStep {
    title: string;
    command?: string;
    url?: string;
    note?: string;
}
export interface UserNextSteps {
    description: string;
    steps: NextStep[];
}
export interface PluginWarning {
    plugin: string;
    error: string;
    hint: string;
}
/**
 * Write NDJSON message to stdout.
 * Only outputs if running under an AI agent.
 * Each message is a single line of JSON.
 */
export declare function writeAiOutput(message: Record<string, any>): void;
/**
 * Log progress stage.
 * Only outputs if running under an AI agent.
 */
export declare function logProgress(stage: string, message: string): void;
/**
 * Write detailed error information to a temp file for AI debugging.
 * Returns the path to the error log file.
 */
export declare function writeErrorLog(error: Error | unknown, commandName?: string): string;
