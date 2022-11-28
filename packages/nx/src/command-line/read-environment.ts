import { NxConfig } from '../config/nx-json';
import {
  readNxConfig,
  readAllWorkspaceConfiguration,
} from '../config/configuration';

export interface Environment {
  nxConfig: NxConfig;
  workspaceJson: any;
  /**
   * @deprecated the field will be removed after Nx 14 is released. It's left here
   * not to break the type checker in case someone extends
   * the tasks runner
   */
  workspaceResults: any;
}

/**
 * @deprecated Read workspaceJson from projectGraph, and use readNxConfig on its own.
 */
export function readEnvironment(): Environment {
  const nxConfig = readNxConfig();
  const workspaceJson = readAllWorkspaceConfiguration();
  return { nxConfig, workspaceJson, workspaceResults: null } as any;
}
