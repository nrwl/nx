/**
 * AI Agent NDJSON Output Utilities for nx init
 *
 * When an AI agent is detected, nx init switches to AI-optimized output mode:
 * - NDJSON (Newline-Delimited JSON) output for structured parsing
 * - Progress stages for tracking initialization steps
 * - Structured success/error/needs_input results
 *
 * NOTE: This is intentionally duplicated from create-nx-workspace.
 * CNW is self-contained and cannot import from the nx package.
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { isAiAgent } from '../../../native';

// Progress stages for NDJSON streaming
export type ProgressStage =
  | 'starting'
  | 'detecting'
  | 'configuring'
  | 'installing'
  | 'plugins'
  | 'complete'
  | 'error'
  | 'needs_input';

// Error codes specific to nx init
export type NxInitErrorCode =
  | 'ALREADY_INITIALIZED'
  | 'PACKAGE_INSTALL_ERROR'
  | 'UNCOMMITTED_CHANGES'
  | 'UNSUPPORTED_PROJECT'
  | 'PLUGIN_INIT_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ProgressMessage {
  stage: ProgressStage;
  message: string;
}

export interface DetectedPlugin {
  name: string;
  reason: string;
}

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

export interface SuccessResult {
  stage: 'complete';
  success: true;
  result: {
    nxVersion: string;
    projectsDetected: number;
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

export type AiOutputMessage =
  | ProgressMessage
  | NeedsInputResult
  | SuccessResult
  | ErrorResult;

/**
 * Write NDJSON message to stdout.
 * Only outputs if running under an AI agent.
 * Each message is a single line of JSON.
 */
export function writeAiOutput(message: AiOutputMessage): void {
  if (isAiAgent()) {
    process.stdout.write(JSON.stringify(message) + '\n');

    // For success results, output plain text instructions that the agent can show the user
    if (
      message.stage === 'complete' &&
      'success' in message &&
      message.success
    ) {
      const successMsg = message as SuccessResult;
      const steps = successMsg.userNextSteps.steps;

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

/**
 * Log progress stage during initialization.
 * Only outputs if running under an AI agent.
 */
export function logProgress(stage: ProgressStage, message: string): void {
  writeAiOutput({ stage, message });
}

/**
 * Build needs_input result for plugin selection.
 * This tells the AI which plugins are available and how to proceed.
 */
export function buildNeedsInputResult(
  detectedPlugins: DetectedPlugin[]
): NeedsInputResult {
  const pluginList = detectedPlugins.map((p) => p.name).join(',');

  return {
    stage: 'needs_input',
    success: false,
    inputType: 'plugins',
    message:
      'Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.',
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
export function buildSuccessResult(options: {
  nxVersion: string;
  projectsDetected: number;
  pluginsInstalled: string[];
  warnings?: PluginWarning[];
}): SuccessResult {
  const { nxVersion, projectsDetected, pluginsInstalled, warnings } = options;

  // Build user-facing next steps
  const steps: NextStep[] = [
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

  const successResult: SuccessResult = {
    stage: 'complete',
    success: true,
    result: {
      nxVersion,
      projectsDetected,
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
export function buildErrorResult(
  error: string,
  errorCode: NxInitErrorCode,
  errorLogPath?: string
): ErrorResult {
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
export function getErrorHints(errorCode: NxInitErrorCode): string[] {
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
 * Write detailed error information to a temp file for AI debugging.
 * Returns the path to the error log file.
 */
export function writeErrorLog(error: Error | unknown): string {
  const timestamp = Date.now();
  const errorLogPath = join(tmpdir(), `nx-init-error-${timestamp}.log`);

  let errorDetails = `Nx Init Error Log\n`;
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
    // If we can't write the log, return empty path
    return '';
  }

  return errorLogPath;
}

/**
 * Determine error code from an error object.
 */
export function determineErrorCode(error: Error | unknown): NxInitErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('nx.json already exists') ||
    lowerMessage.includes('already initialized')
  ) {
    return 'ALREADY_INITIALIZED';
  }

  if (
    lowerMessage.includes('install') ||
    lowerMessage.includes('npm') ||
    lowerMessage.includes('yarn') ||
    lowerMessage.includes('pnpm')
  ) {
    return 'PACKAGE_INSTALL_ERROR';
  }

  if (
    lowerMessage.includes('uncommitted') ||
    lowerMessage.includes('git status')
  ) {
    return 'UNCOMMITTED_CHANGES';
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('etimedout')
  ) {
    return 'NETWORK_ERROR';
  }

  if (lowerMessage.includes('plugin') || lowerMessage.includes('generator')) {
    return 'PLUGIN_INIT_ERROR';
  }

  return 'UNKNOWN';
}
