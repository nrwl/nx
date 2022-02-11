import { joinPathFragments, ProjectConfiguration, Tree } from '@nrwl/devkit';
import { CYPRESS_COMPONENT_TEST_TARGET } from '../../utils/project-name';
import { installedCypressVersion } from '../../utils/cypress-version';

export enum ComponentTestingProjectState {
  /**
   * the project already has component testing setup.
   * but did not provide a force flag to override the setup.
   */
  ALREADY_SETUP,
  /**
   * Safe to install cypress.
   */
  INSTALL,
  /**
   * A cypress version > 10 is already installed. No need to install cypress.
   */
  NO_INSTALL,
  /**
   * A cypress version < 10 is installed. Need to upgrade to v10 before allowing a cypress component project to be created.
   */
  UPGRADE,
}

/**
 * Check the installed version of cypress to determine
 * if a project is compatible with cypress component testing.
 */
export function cypressComponentTestingState(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: InstallOptions = { force: false }
): ComponentTestingProjectState {
  // if the project already has the component testing target or a cypress.config.ts file then we make sure the --force flag is sent. if not, we throw an error.
  if (
    projectConfig.targets?.[CYPRESS_COMPONENT_TEST_TARGET] ||
    tree.exists(joinPathFragments(projectConfig.root, 'cypress.config.ts'))
  ) {
    if (!options.force) {
      return ComponentTestingProjectState.ALREADY_SETUP;
    }
    return ComponentTestingProjectState.INSTALL;
  }

  const installedVersion = installedCypressVersion();
  // if we don't have a version then it's safe to install cypress
  if (!installedVersion) {
    return ComponentTestingProjectState.INSTALL;
  }

  if (installedVersion >= 10) {
    return ComponentTestingProjectState.NO_INSTALL;
  }

  return ComponentTestingProjectState.UPGRADE;
}

export interface InstallOptions {
  force: boolean;
}
