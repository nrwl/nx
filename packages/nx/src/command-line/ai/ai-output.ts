/**
 * Shared AI Agent NDJSON Output Utilities
 *
 * Base types and utilities for AI agent output across all Nx commands.
 * Each command extends with its own specific progress stages, error codes, and result types.
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { isAiAgent } from '../../native';

// Base progress stages shared by all commands
export type BaseProgressStage =
  | 'starting'
  | 'complete'
  | 'error'
  | 'needs_input';

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
export function writeAiOutput(message: Record<string, any>): void {
  if (isAiAgent()) {
    process.stdout.write(JSON.stringify(message) + '\n');

    // For success results, output plain text instructions that the agent can show the user
    if (
      message.stage === 'complete' &&
      'success' in message &&
      message.success &&
      'userNextSteps' in message
    ) {
      const steps = (message as any).userNextSteps?.steps;
      if (Array.isArray(steps)) {
        let plainText = '\n---USER_NEXT_STEPS---\n';
        plainText +=
          '[DISPLAY] Show the user these next steps to complete setup:\n\n';

        steps.forEach((step: NextStep, i: number) => {
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
export function logProgress(stage: string, message: string): void {
  writeAiOutput({ stage, message });
}

/**
 * Write detailed error information to a temp file for AI debugging.
 * Returns the path to the error log file.
 */
export function writeErrorLog(
  error: Error | unknown,
  commandName: string = 'nx'
): string {
  const timestamp = Date.now();
  const errorLogPath = join(tmpdir(), `${commandName}-error-${timestamp}.log`);

  let errorDetails = `Nx ${commandName} Error Log\n`;
  errorDetails += `==================\n`;
  errorDetails += `Timestamp: ${new Date(timestamp).toISOString()}\n\n`;

  if (error instanceof Error) {
    errorDetails += `Error: ${error.message}\n\n`;
    if (error.stack) {
      errorDetails += `Stack Trace:\n${error.stack}\n`;
    }
  } else {
    errorDetails += `Error: ${String(error)}\n`;
  }

  try {
    writeFileSync(errorLogPath, errorDetails);
  } catch {
    return '';
  }

  return errorLogPath;
}
