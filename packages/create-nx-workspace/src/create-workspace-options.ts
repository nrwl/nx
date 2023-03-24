import { PackageManager } from './utils/package-manager';
import { CI } from './utils/ci/ci-list';

export interface CreateWorkspaceOptions {
  name: string; // Workspace name (e.g. org name)
  packageManager: PackageManager; // Package manager to use
  nxCloud: boolean; // Enable Nx Cloud
  /**
   * @description Enable interactive mode with presets
   * @default true
   */
  interactive?: boolean; // Enable interactive mode with presets
  /**
   * @description Generate a CI workflow file
   * @default ''
   */
  ci?: CI;
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
}
