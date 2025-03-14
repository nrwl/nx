import { TargetConfiguration } from '@nx/devkit';

const SUPPORTED_BUILD_EXECUTORS = [
  '@angular-devkit/build-angular:browser',
  '@nx/angular:webpack-browser',
];

export function validateSupportedBuildExecutor(targets: TargetConfiguration[]) {
  const executorsUsedByProject = targets.map((target) => target.executor);
  if (
    !executorsUsedByProject.some((executor) =>
      SUPPORTED_BUILD_EXECUTORS.includes(executor)
    )
  ) {
    throw new Error(
      'The project does not use a supported build executor. Please use one of the following executors: ' +
        SUPPORTED_BUILD_EXECUTORS.join(', ')
    );
  }
}
