import type { NxJsonConfiguration } from '@nrwl/devkit';

export interface Environment {
  nxJson: NxJsonConfiguration;
  workspaceJson: any;
  /**
   * @deprecated the field will be removed after Nx 14 is released. It's left here
   * not to break the type checker in case someone extends
   * the tasks runner
   */
  workspaceResults: any;
}
