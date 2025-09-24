import { NxCloud } from './utils/nx/nx-cloud';
import { PackageManager } from './utils/package-manager';

export interface CreateWorkspaceOptions {
  name: string; // Workspace name (e.g. org name)
  packageManager: PackageManager; // Package manager to use
  nxCloud: NxCloud; // Enable Nx Cloud
  useGitHub?: boolean; // Will you be using GitHub as your git hosting provider?
  /**
   * @description Enable interactive mode with presets
   * @default true
   */
  interactive?: boolean; // Enable interactive mode with presets
  /**
   * @description Default base to use for new projects. e.g. main, master
   * @default 'main'
   */
  defaultBase?: string;
  /**
   * @description Skip initializing a git repository
   * @default false
   */
  skipGit?: boolean; // Skip initializing a git repository
  /**
   * @description Skip pushing to GitHub via gh CLI
   * @default false
   */
  skipGitHubPush?: boolean; // Skip pushing to GitHub via gh CLI
  /**
   * @description Enable verbose logging
   * @default false
   */
  verbose?: boolean; // Enable verbose logging
  commit?: {
    name: string; // Name to use for the initial commit
    email: string; // Email to use for the initial commit
    message: string; // Message to use for the initial commit
  };
  cliName?: string; // Name of the CLI, used when displaying outputs. e.g. nx, Nx
  aiAgents?: Agent[]; // List of AI agents to configure
}

export const availableAgents = [
  'claude',
  'codex',
  'copilot',
  'cursor',
  'gemini',
] as const;
export type Agent = (typeof availableAgents)[number];
