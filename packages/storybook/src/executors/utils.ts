import { ExecutorContext } from '@nrwl/devkit';

export interface NodePackage {
  name: string;
  version: string;
}

// see: https://github.com/storybookjs/storybook/pull/12565
// TODO: this should really be passed as a param to the CLI rather than env
export function setStorybookAppProject(
  context: ExecutorContext,
  leadStorybookProject: string
) {
  let leadingProject: string;
  // for libs we check whether the build config should be fetched
  // from some app

  if (
    context.workspace.projects[context.projectName].projectType === 'library'
  ) {
    // we have a lib so let's try to see whether the app has
    // been set from which we want to get the build config
    if (leadStorybookProject) {
      leadingProject = leadStorybookProject;
    } else {
      // do nothing
      return;
    }
  } else {
    // ..for apps we just use the app target itself
    leadingProject = context.projectName;
  }

  process.env.STORYBOOK_ANGULAR_PROJECT = leadingProject;
}
