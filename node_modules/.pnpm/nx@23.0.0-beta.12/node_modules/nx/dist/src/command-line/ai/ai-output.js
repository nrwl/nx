"use strict";
/**
 * Shared AI Agent NDJSON Output Utilities
 *
 * Base types and utilities for AI agent output across all Nx commands.
 * Each command extends with its own specific progress stages, error codes, and result types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAiOutput = writeAiOutput;
exports.logProgress = logProgress;
exports.writeErrorLog = writeErrorLog;
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
const native_1 = require("../../native");
/**
 * Write NDJSON message to stdout.
 * Only outputs if running under an AI agent.
 * Each message is a single line of JSON.
 */
function writeAiOutput(message) {
    if ((0, native_1.isAiAgent)()) {
        process.stdout.write(JSON.stringify(message) + '\n');
        // For success results, output plain text instructions that the agent can show the user
        if (message.stage === 'complete' &&
            'success' in message &&
            message.success &&
            'userNextSteps' in message) {
            const steps = message.userNextSteps?.steps;
            if (Array.isArray(steps)) {
                let plainText = '\n---USER_NEXT_STEPS---\n';
                plainText +=
                    '[DISPLAY] Show the user these next steps to complete setup:\n\n';
                steps.forEach((step, i) => {
                    plainText += `${i + 1}. ${step.title}`;
                    if (step.command) {
                        plainText += `\n   Run: ${step.command}`;
                    }
                    if (step.url) {
                        plainText += `\n   Visit: ${step.url}`;
                    }
                    if (step.note) {
                        plainText += `\n   ${step.note}`;
                    }
                    plainText += '\n';
                });
                plainText += '---END---\n';
                process.stdout.write(plainText);
            }
        }
    }
}
/**
 * Log progress stage.
 * Only outputs if running under an AI agent.
 */
function logProgress(stage, message) {
    writeAiOutput({ stage, message });
}
/**
 * Write detailed error information to a temp file for AI debugging.
 * Returns the path to the error log file.
 */
function writeErrorLog(error, commandName = 'nx') {
    const timestamp = Date.now();
    const errorLogPath = (0, path_1.join)((0, os_1.tmpdir)(), `${commandName}-error-${timestamp}.log`);
    let errorDetails = `Nx ${commandName} Error Log\n`;
    errorDetails += `==================\n`;
    errorDetails += `Timestamp: ${new Date(timestamp).toISOString()}\n\n`;
    if (error instanceof Error) {
        errorDetails += `Error: ${error.message}\n\n`;
        if (error.stack) {
            errorDetails += `Stack Trace:\n${error.stack}\n`;
        }
    }
    else {
        errorDetails += `Error: ${String(error)}\n`;
    }
    try {
        (0, fs_1.writeFileSync)(errorLogPath, errorDetails);
    }
    catch {
        return '';
    }
    return errorLogPath;
}
