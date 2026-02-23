/**
 * AI Agent NDJSON Output Utilities for nx import
 *
 * Extends the shared base with import-specific types and builders.
 */

import {
  writeAiOutput,
  logProgress,
  writeErrorLog,
  type DetectedPlugin,
  type NextStep,
  type UserNextSteps,
  type PluginWarning,
} from '../../ai/ai-output';

// Re-export shared utilities for convenience
export { writeAiOutput, logProgress, writeErrorLog };

// Import-specific progress stages
export type ImportProgressStage =
  | 'starting'
  | 'cloning'
  | 'filtering'
  | 'merging'
  | 'detecting-plugins'
  | 'installing'
  | 'installing-plugins'
  | 'complete'
  | 'error'
  | 'needs_input';

// Import-specific error codes
export type NxImportErrorCode =
  | 'UNCOMMITTED_CHANGES'
  | 'CLONE_FAILED'
  | 'SOURCE_NOT_FOUND'
  | 'DESTINATION_NOT_EMPTY'
  | 'INVALID_DESTINATION'
  | 'FILTER_FAILED'
  | 'MERGE_FAILED'
  | 'PACKAGE_INSTALL_ERROR'
  | 'PLUGIN_INIT_ERROR'
  | 'UNKNOWN';

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
  type:
    | 'package_manager_mismatch'
    | 'config_path_mismatch'
    | 'missing_root_deps'
    | 'install_failed'
    | 'plugin_install_failed';
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

export type ImportAiOutputMessage =
  | { stage: ImportProgressStage; message: string }
  | ImportNeedsOptionsResult
  | ImportNeedsPluginSelectionResult
  | ImportSuccessResult
  | ImportErrorResult;

const AVAILABLE_OPTIONS: Record<string, ImportOptionInfo> = {
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
    description:
      'Directory within the source repo to import (blank = entire repo).',
    flag: '--source',
    required: false,
  },
  destination: {
    description: 'Target directory in this workspace to import into.',
    flag: '--destination',
    required: true,
  },
};

export function buildImportNeedsOptionsResult(
  missingFields: string[],
  sourceRepository?: string
): ImportNeedsOptionsResult {
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

export function buildImportNeedsPluginSelectionResult(options: {
  detectedPlugins: DetectedPlugin[];
  sourceRepository: string;
  ref: string;
  source: string;
  destination: string;
}): ImportNeedsPluginSelectionResult {
  const pluginList = options.detectedPlugins.map((p) => p.name).join(',');

  return {
    stage: 'needs_input',
    success: false,
    inputType: 'plugins',
    message:
      'Import complete. Plugin selection required. Ask the user which plugins to install, then run again with --plugins flag.',
    detectedPlugins: options.detectedPlugins,
    options: ['--plugins=skip', '--plugins=all', `--plugins=${pluginList}`],
    recommendedOption: '--plugins=skip',
    recommendedReason: 'Plugins can be added later with nx add.',
    exampleCommand: `nx import ${options.sourceRepository} ${options.destination} --ref=${options.ref} --source=${options.source} --plugins=${options.detectedPlugins[0]?.name || '@nx/vite'}`,
    result: {
      sourceRepository: options.sourceRepository,
      ref: options.ref,
      source: options.source,
      destination: options.destination,
    },
  };
}

export function buildImportSuccessResult(options: {
  sourceRepository: string;
  ref: string;
  source: string;
  destination: string;
  pluginsInstalled: string[];
  warnings?: ImportWarning[];
}): ImportSuccessResult {
  const steps: NextStep[] = [
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

  const result: ImportSuccessResult = {
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

export function buildImportErrorResult(
  error: string,
  errorCode: NxImportErrorCode,
  errorLogPath?: string
): ImportErrorResult {
  return {
    stage: 'error',
    success: false,
    errorCode,
    error,
    hints: getImportErrorHints(errorCode),
    errorLogPath,
  };
}

export function getImportErrorHints(errorCode: NxImportErrorCode): string[] {
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

export function determineImportErrorCode(
  error: Error | unknown
): NxImportErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('uncommitted')) return 'UNCOMMITTED_CHANGES';
  if (lower.includes('failed to clone')) return 'CLONE_FAILED';
  if (lower.includes('does not exist in')) return 'SOURCE_NOT_FOUND';
  if (lower.includes('is not empty') || lower.includes('destination directory'))
    return 'DESTINATION_NOT_EMPTY';
  if (lower.includes('must be a relative path')) return 'INVALID_DESTINATION';
  if (
    lower.includes('filter-repo') ||
    lower.includes('filter-branch') ||
    lower.includes('filter')
  )
    return 'FILTER_FAILED';
  if (lower.includes('merge')) return 'MERGE_FAILED';
  if (lower.includes('install')) return 'PACKAGE_INSTALL_ERROR';
  if (lower.includes('plugin') || lower.includes('generator'))
    return 'PLUGIN_INIT_ERROR';

  return 'UNKNOWN';
}
