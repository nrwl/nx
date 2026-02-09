/**
 * AI Agent Detection and NDJSON Output Utilities
 *
 * When an AI agent is detected via environment variables, CNW switches to
 * AI-optimized output mode:
 * - NDJSON (Newline-Delimited JSON) output
 * - No spinners
 * - Non-interactive mode
 * - Structured progress and result messages
 */

import { CnwErrorCode } from '../error-utils';

let _isAiAgent: boolean | null = null;
export function isAiAgent(): boolean {
  if (_isAiAgent === null) {
    _isAiAgent = isClaudeCode() || isOpenCode() || isReplitAi() || isCursorAi();
  }
  return _isAiAgent;
}

export function isClaudeCode(): boolean {
  return !!process.env.CLAUDECODE || !!process.env.CLAUDE_CODE;
}

export function isOpenCode(): boolean {
  return !!process.env.OPENCODE;
}

export function isReplitAi(): boolean {
  return !!process.env.REPL_ID;
}

export function isCursorAi(): boolean {
  const pagerMatches = process.env.PAGER === 'head -n 10000 | cat';
  const hasCursorTraceId = !!process.env.CURSOR_TRACE_ID;
  const hasComposerNoInteraction = !!process.env.COMPOSER_NO_INTERACTION;
  return pagerMatches && hasCursorTraceId && hasComposerNoInteraction;
}

// Progress stages for NDJSON streaming
export type ProgressStage =
  | 'starting'
  | 'cloning'
  | 'installing'
  | 'configuring'
  | 'initializing'
  | 'complete'
  | 'error';

export interface ProgressMessage {
  stage: ProgressStage;
  message: string;
}

export interface TemplateOption {
  name: string;
  value: string;
  description: string;
}

export interface TemplateRequiredResult {
  stage: 'needs_input';
  success: false;
  title: string;
  message: string;
  suggestedName: string;
  templates: TemplateOption[];
  recommendedTemplate: string;
  exampleCommand: string;
  docsGettingStarted: string;
}

export interface NextStep {
  title: string;
  url?: string;
  note?: string;
}

export interface UserNextSteps {
  /** Description for the AI about what to do with these steps */
  description: string;
  steps: NextStep[];
}

export interface SuccessResult {
  stage: 'complete';
  success: true;
  /** Informational data about what was created */
  result: {
    title: string;
    workspacePath: string;
    workspaceName: string;
    template?: string;
    preset?: string;
  };
  /** Display these to the user as next steps */
  userNextSteps: UserNextSteps;
  /** Reference documentation */
  docs: {
    gettingStarted: string;
    nxCloud: string;
  };
}

export interface ErrorResult {
  stage: 'error';
  success: false;
  title: string;
  error: string;
  errorCode: CnwErrorCode | 'UNKNOWN';
  hints: string[];
  errorLogPath?: string;
  docsGettingStarted: string;
}

export interface PartialSuccessResult extends SuccessResult {
  nxCloudError?: string;
}

export type AiOutputMessage =
  | ProgressMessage
  | TemplateRequiredResult
  | SuccessResult
  | ErrorResult;

/**
 * Write NDJSON message to stdout.
 * Each message is a single line of JSON.
 * For success results, also outputs plain text instructions at the end.
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
        if (step.url) {
          plainText += `: ${step.url}`;
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
 * Log progress stage during workspace creation
 */
export function logProgress(stage: ProgressStage, message: string): void {
  writeAiOutput({ stage, message });
}

/**
 * Build template required result for AI agents
 * This tells the AI which templates are available and how to proceed
 */
export function buildTemplateRequiredResult(
  workspaceName?: string
): TemplateRequiredResult {
  // Use provided name or suggest default
  const name = workspaceName || SUGGESTED_WORKSPACE_NAME;

  return {
    stage: 'needs_input',
    success: false,
    title: 'Template Selection Required',
    message:
      'Ask the user which workspace type they want, then run again with --template. If the directory exists, append a number (e.g., my-nx-repo-2).',
    suggestedName: name,
    templates: [
      {
        name: 'Empty Monorepo',
        value: 'nrwl/empty-template',
        description:
          'Minimal workspace to build on - best for custom setups or learning Nx.',
      },
      {
        name: 'React Fullstack',
        value: 'nrwl/react-template',
        description:
          'Complete React + Express monorepo with examples and best practices.',
      },
      {
        name: 'Angular Fullstack',
        value: 'nrwl/angular-template',
        description: 'Complete Angular + Express monorepo with examples.',
      },
      {
        name: 'TypeScript/npm Packages',
        value: 'nrwl/typescript-template',
        description: 'For building and publishing npm packages.',
      },
    ],
    recommendedTemplate: 'nrwl/empty-template',
    exampleCommand: `npx create-nx-workspace@latest ${name} --template=nrwl/empty-template`,
    docsGettingStarted: 'https://nx.dev/getting-started/intro',
  };
}

/**
 * Build success result object
 */
export function buildSuccessResult(options: {
  workspacePath: string;
  workspaceName: string;
  template?: string;
  preset?: string;
  nxCloudConnectUrl?: string;
  nxCloudError?: string;
}): SuccessResult | PartialSuccessResult {
  const {
    workspacePath,
    workspaceName,
    template,
    preset,
    nxCloudConnectUrl,
    nxCloudError,
  } = options;

  // Build result data
  const resultData: SuccessResult['result'] = {
    title: 'Nx Workspace Created Successfully',
    workspacePath,
    workspaceName,
  };

  if (template) {
    resultData.template = template;
  }
  if (preset) {
    resultData.preset = preset;
  }

  // Build user-facing next steps
  const steps: NextStep[] = [];

  // Nx Cloud connection step last (so it stands out)
  if (nxCloudConnectUrl) {
    steps.push({
      title: 'Connect to Nx Cloud (Recommended)',
      url: nxCloudConnectUrl,
      note: 'Complete setup to enable remote caching and CI insights',
    });
  }

  const userNextSteps: UserNextSteps = {
    description: 'CRITICAL: Show the user these exact steps to complete setup.',
    steps,
  };

  const successResult: SuccessResult = {
    stage: 'complete',
    success: true,
    result: resultData,
    userNextSteps,
    docs: {
      gettingStarted: 'https://nx.dev/getting-started/intro',
      nxCloud: 'https://nx.dev/ci/intro/why-nx-cloud',
    },
  };

  if (nxCloudError) {
    (successResult as PartialSuccessResult).nxCloudError = nxCloudError;
  }

  return successResult;
}

/**
 * Build error result object with helpful hints
 */
export function buildErrorResult(
  error: string,
  errorCode: CnwErrorCode | 'UNKNOWN',
  errorLogPath?: string
): ErrorResult {
  const hints = getErrorHints(errorCode);

  return {
    stage: 'error',
    success: false,
    title: 'Workspace Creation Failed',
    error,
    errorCode,
    hints,
    errorLogPath,
    docsGettingStarted: 'https://nx.dev/getting-started/intro',
  };
}

/**
 * Get helpful hints based on error code
 */
function getErrorHints(errorCode: CnwErrorCode | 'UNKNOWN'): string[] {
  switch (errorCode) {
    case 'DIRECTORY_EXISTS':
      return [
        'Choose a different workspace name',
        "Remove the existing directory with 'rm -rf <directory>'",
      ];
    case 'INVALID_FOLDER_NAME':
      return [
        'Workspace names must start with a letter',
        'Examples of valid names: myapp, MyApp, my-app, my_app',
      ];
    case 'INVALID_PRESET':
      return [
        'Check the preset name spelling',
        'Run with --help to see available presets',
        'Use --template for template-based workspaces',
      ];
    case 'NETWORK_ERROR':
      return [
        'Check your internet connection',
        'Try again in a few moments',
        'Check if npm/yarn registry is accessible',
      ];
    case 'PACKAGE_INSTALL_ERROR':
      return [
        'Check your package manager is installed correctly',
        'Try clearing npm/yarn cache',
        'Check for conflicting global packages',
      ];
    default:
      return [
        'Check the error message for details',
        'Visit https://nx.dev/getting-started/intro for documentation',
        'Report issues at https://github.com/nrwl/nx/issues',
      ];
  }
}

/**
 * Suggested workspace name for AI mode.
 * AI should check if directory exists and append a number if needed.
 */
export const SUGGESTED_WORKSPACE_NAME = 'my-nx-repo';
