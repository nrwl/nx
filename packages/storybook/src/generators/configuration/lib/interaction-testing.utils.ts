import {
  applyChangesToString,
  ChangeType,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  storybookJestVersion,
  storybookTestingLibraryVersion,
  storybookTestRunnerVersion,
  storybookVersion,
} from '../../../utils/versions';

function getMainTsJsPath(
  host: Tree,
  projectConfig: ProjectConfiguration
): string | undefined {
  // Inferred targets from `@nx/storybook/plugin` are inferred from `.storybook/main.{js,ts,mjs,mts,cjs,cts}` so we can assume the directory.
  if (!projectConfig.targets) {
    const exts = ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts'];
    for (const ext of exts) {
      const candidate = `${projectConfig.root}/.storybook/main.${ext}`;
      if (host.exists(candidate)) return candidate;
    }
    throw new Error(
      `Cannot find main Storybook file. Does this file exist? e.g. ${projectConfig.root}/.storybook/main.ts`
    );
  }

  let mainJsTsPath: string | undefined = undefined;
  Object.entries(projectConfig.targets).forEach(
    ([_targetName, targetConfig]) => {
      if (
        targetConfig.executor === '@nx/storybook:storybook' ||
        targetConfig.executor === '@storybook/angular:start-storybook'
      ) {
        const configDir = targetConfig.options?.configDir;
        if (host.exists(`${configDir}/main.js`)) {
          mainJsTsPath = `${configDir}/main.js`;
        }
        if (host.exists(`${configDir}/main.ts`)) {
          mainJsTsPath = `${configDir}/main.ts`;
        }
      }
    }
  );
  return mainJsTsPath;
}
