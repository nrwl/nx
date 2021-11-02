import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getWorkspace,
  getWorkspacePath,
  serializeJson,
  updateWorkspace,
} from '@nrwl/workspace';
import { addPropertyToJestConfig } from '../utils/config/legacy/update-config';
import { getJestObject } from './require-jest-config';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

function checkJestPropertyObject(object: unknown): object is object {
  return object !== null && object !== undefined;
}

function modifyJestConfig(
  host: Tree,
  context: SchematicContext,
  project: string,
  setupFile: string,
  jestConfig: string,
  tsConfig: string,
  isAngular: boolean
) {
  let globalTsJest: any = {
    tsConfig,
  };

  if (isAngular) {
    globalTsJest = {
      ...globalTsJest,
      stringifyContentPathRegex: '\\.(html|svg)$',
      astTransformers: [
        'jest-preset-angular/build/InlineFilesTransformer',
        'jest-preset-angular/build/StripStylesTransformer',
      ],
    };
  }

  try {
    const jestObject = getJestObject(`${appRootPath}/${jestConfig}`);

    if (setupFile !== '') {
      // add set up env file
      // setupFilesAfterEnv
      const existingSetupFiles = jestObject.setupFilesAfterEnv;

      let setupFilesAfterEnv: string | string[] = [setupFile];
      if (Array.isArray(existingSetupFiles)) {
        setupFilesAfterEnv = setupFile;
      }

      addPropertyToJestConfig(
        host,
        jestConfig,
        'setupFilesAfterEnv',
        setupFilesAfterEnv
      );
    }

    // check if jest config has babel transform
    const transformProperty = jestObject.transform;

    let hasBabelTransform = false;
    if (transformProperty) {
      for (const prop in transformProperty) {
        const transformPropValue = transformProperty[prop];
        if (Array.isArray(transformPropValue)) {
          hasBabelTransform = transformPropValue.some(
            (value) => typeof value === 'string' && value.includes('babel')
          );
        } else if (typeof transformPropValue === 'string') {
          transformPropValue.includes('babel');
        }
      }
    }

    if (hasBabelTransform) {
      return;
    }

    // Add ts-jest configurations
    const existingGlobals = jestObject.globals;
    if (!existingGlobals) {
      addPropertyToJestConfig(host, jestConfig, 'globals', {
        'ts-jest': globalTsJest,
      });
    } else {
      const existingGlobalTsJest = existingGlobals['ts-jest'];
      if (!checkJestPropertyObject(existingGlobalTsJest)) {
        addPropertyToJestConfig(
          host,
          jestConfig,
          'globals.ts-jest',
          globalTsJest
        );
      }
    }
  } catch {
    context.logger.warn(`
    Cannot update jest config for the ${project} project.
    This is most likely caused because the jest config at ${jestConfig} it not in a expected configuration format (ie. module.exports = {}).

    Since this migration could not be ran on this project, please make sure to modify the Jest config file to have the following configured:
    * setupFilesAfterEnv with: "${setupFile}"
    * globals.ts-jest with:
    "${serializeJson(globalTsJest)}"
  `);
  }
}

function updateJestConfigForProjects() {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    for (const [projectName, projectDefinition] of workspace.projects) {
      for (const [, testTarget] of projectDefinition.targets) {
        if (testTarget.builder !== '@nrwl/jest:jest') {
          continue;
        }

        const setupfile = testTarget.options?.setupFile;
        const jestConfig = (testTarget.options?.jestConfig as string) ?? '';
        const tsConfig = (testTarget.options?.tsConfig as string) ?? '';
        const tsConfigWithRootDir = tsConfig.replace(
          projectDefinition.root,
          '<rootDir>'
        );

        let isAngular = false;
        let setupFileWithRootDir = '';
        if (typeof setupfile === 'string') {
          isAngular = host
            .read(setupfile)
            ?.toString()
            .includes('jest-preset-angular');
          setupFileWithRootDir = setupfile.replace(
            projectDefinition.root,
            '<rootDir>'
          );
        }

        modifyJestConfig(
          host,
          context,
          projectName,
          setupFileWithRootDir,
          jestConfig,
          tsConfigWithRootDir,
          isAngular
        );

        const updatedOptions = { ...testTarget.options };
        delete updatedOptions.setupFile;
        delete updatedOptions.tsConfig;

        testTarget.options = updatedOptions;
      }
    }

    return updateWorkspace(workspace);
  };
}

export default function update(): Rule {
  return chain([updateJestConfigForProjects(), formatFiles()]);
}
