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
  commit?: {
    name: string; // Name to use for the initial commit
    email: string; // Email to use for the initial commit
    message: string; // Message to use for the initial commit
  };
  cliName?: string; // Name of the CLI, used when displaying outputs. e.g. nx, Nx
}
