import type {
  ProjectConfiguration,
  TargetConfiguration,
} from 'packages/devkit';

export function isZonelessApp(project: ProjectConfiguration): boolean {
  const buildTarget = findBuildTarget(project);
  if (!buildTarget?.options?.polyfills) {
    return true;
  }

  const polyfills = buildTarget.options.polyfills as string[] | string;
  const polyfillsList = Array.isArray(polyfills) ? polyfills : [polyfills];

  return !polyfillsList.includes('zone.js');
}

function findBuildTarget(
  project: ProjectConfiguration
): TargetConfiguration | null {
  for (const target of Object.values(project.targets ?? {})) {
    if (
      [
        '@angular-devkit/build-angular:browser',
        '@angular-devkit/build-angular:browser-esbuild',
        '@angular-devkit/build-angular:application',
        '@angular/build:application',
        '@nx/angular:application',
        '@nx/angular:browser-esbuild',
        '@nx/angular:webpack-browser',
      ].includes(target.executor)
    ) {
      return target;
    }
  }

  return project.targets?.build ?? null;
}
