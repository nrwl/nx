/**
 * AI Agent NDJSON Output Utilities for nx connect
 *
 * When an AI agent is detected, nx connect switches to AI-optimized output mode:
 * - NDJSON (Newline-Delimited JSON) output for structured parsing
 * - Structured success/error/needs_input results
 */

import { isAiAgent } from '../../../native';

// Progress stages for NDJSON streaming
export type ConnectProgressStage =
  | 'starting'
  | 'connecting'
  | 'complete'
  | 'error'
  | 'needs_input';

// Error codes specific to nx connect
export type NxConnectErrorCode =
  | 'MISSING_VCS_REMOTE'
  | 'ALREADY_CONNECTED'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ProgressMessage {
  stage: ConnectProgressStage;
  message: string;
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

export interface NeedsInputResult {
  stage: 'needs_input';
  success: false;
  inputType: 'vcs_remote';
  errorCode: NxConnectErrorCode;
  message: string;
  hints: string[];
  suggestedCommands: {
    command: string;
    description: string;
  }[];
  recommendedOption: string;
  recommendedReason: string;
}

export interface SuccessResult {
  stage: 'complete';
  success: true;
  result: {
    connectUrl: string;
    alreadyConnected: boolean;
  };
  userNextSteps: UserNextSteps;
  docs: {
    nxCloud: string;
  };
}

export interface ErrorResult {
  stage: 'error';
  success: false;
  errorCode: NxConnectErrorCode;
  error: string;
  hints: string[];
}

export type ConnectAiOutputMessage =
  | ProgressMessage
  | NeedsInputResult
  | SuccessResult
  | ErrorResult;

/**
 * Write NDJSON message to stdout.
 * Only outputs if running under an AI agent.
 * Each message is a single line of JSON.
 */
export function writeConnectAiOutput(message: ConnectAiOutputMessage): void {
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
        '[DISPLAY] Show the user these next steps to complete Nx Cloud setup:\n\n';

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

    // For needs_input, output plain text guidance
    if (message.stage === 'needs_input') {
      const needsInput = message as NeedsInputResult;

      let plainText = '\n---ACTION_REQUIRED---\n';
      plainText += `[ACTION] ${needsInput.message}\n\n`;
      plainText += 'Suggested commands:\n';
      needsInput.suggestedCommands.forEach((cmd) => {
        plainText += `  ${cmd.command}\n    ${cmd.description}\n`;
      });
      plainText += `\nRecommended: ${needsInput.recommendedOption}\n`;
      plainText += `Reason: ${needsInput.recommendedReason}\n`;
      plainText += '---END---\n';

      process.stdout.write(plainText);
    }
  }
}

/**
 * Log progress stage during connection.
 * Only outputs if running under an AI agent.
 */
export function logConnectProgress(
  stage: ConnectProgressStage,
  message: string
): void {
  writeConnectAiOutput({ stage, message });
}

/**
 * Build needs_input result for missing VCS remote.
 * This tells the AI how to help the user push their repo first.
 */
export function buildMissingVcsResult(): NeedsInputResult {
  return {
    stage: 'needs_input',
    success: false,
    inputType: 'vcs_remote',
    errorCode: 'MISSING_VCS_REMOTE',
    message:
      'Repository must be pushed to a VCS provider (e.g., GitHub) before connecting to Nx Cloud. Help the user push their repository, then run nx connect again.',
    hints: [
      'The repository has no remote configured',
      'Nx Cloud needs a VCS provider to enable CI integration features',
      'After pushing, run nx connect to complete setup',
    ],
    suggestedCommands: [
      {
        command: 'gh repo create --source=. --push',
        description:
          'Create a GitHub repo and push (requires GitHub CLI: brew install gh)',
      },
      {
        command: 'git remote add origin <url> && git push -u origin main',
        description: 'Manual: Add remote and push to existing repo',
      },
    ],
    recommendedOption: 'gh repo create --source=. --push',
    recommendedReason:
      'GitHub CLI can create the repo and push in one command. User can choose public or private when prompted.',
  };
}

/**
 * Build success result for already connected workspace.
 */
export function buildAlreadyConnectedResult(connectUrl: string): SuccessResult {
  return {
    stage: 'complete',
    success: true,
    result: {
      connectUrl,
      alreadyConnected: true,
    },
    userNextSteps: {
      description: 'Show user how to complete Nx Cloud account connection.',
      steps: [
        {
          title: 'Connect to your Nx Cloud account',
          url: connectUrl,
          note: 'Open this URL to link your workspace to your Nx Cloud account',
        },
      ],
    },
    docs: {
      nxCloud: 'https://nx.dev/ci/intro/why-nx-cloud',
    },
  };
}

/**
 * Build success result for newly connected workspace.
 */
export function buildConnectedResult(connectUrl: string): SuccessResult {
  return {
    stage: 'complete',
    success: true,
    result: {
      connectUrl,
      alreadyConnected: false,
    },
    userNextSteps: {
      description:
        'CRITICAL: User must visit the URL to complete Nx Cloud setup.',
      steps: [
        {
          title: 'Complete Nx Cloud Setup',
          url: connectUrl,
          note: 'Opens in browser automatically. If not, manually open this URL.',
        },
        {
          title: 'Commit the updated nx.json',
          command:
            'git add nx.json && git commit -m "chore: connect to nx cloud"',
          note: 'The nx.json now contains your Nx Cloud ID',
        },
      ],
    },
    docs: {
      nxCloud: 'https://nx.dev/ci/intro/why-nx-cloud',
    },
  };
}

/**
 * Build error result object with helpful hints.
 */
export function buildConnectErrorResult(
  error: string,
  errorCode: NxConnectErrorCode
): ErrorResult {
  const hints = getConnectErrorHints(errorCode);

  return {
    stage: 'error',
    success: false,
    errorCode,
    error,
    hints,
  };
}

/**
 * Get helpful hints based on error code.
 */
export function getConnectErrorHints(errorCode: NxConnectErrorCode): string[] {
  switch (errorCode) {
    case 'MISSING_VCS_REMOTE':
      return [
        'Push the repository to GitHub or another VCS provider first',
        "Use 'gh repo create --source=. --push' for quick GitHub setup",
        'Then run nx connect again',
      ];
    case 'ALREADY_CONNECTED':
      return [
        'Workspace is already connected to Nx Cloud',
        'Visit the connect URL to link to your account',
        'Check nx.json for nxCloudId or nxCloudAccessToken',
      ];
    case 'AUTH_ERROR':
      return [
        'Unable to authenticate with Nx Cloud',
        'Set NX_CLOUD_ACCESS_TOKEN environment variable',
        'Or configure nxCloudId in nx.json',
      ];
    case 'NETWORK_ERROR':
      return [
        'Check your internet connection',
        'Try again in a few moments',
        'Check if cloud.nx.app is accessible',
      ];
    default:
      return [
        'An unexpected error occurred',
        'Check the error message for details',
        'Report issues at https://github.com/nrwl/nx/issues',
      ];
  }
}
