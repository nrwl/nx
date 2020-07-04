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

import {
  addPropertyToJestConfig,
  getPropertyValueInJestConfig,
} from '../../utils/config';

function checkJestPropertyObject(object: unknown): object is object {
  return object !== null && object.constructor.name === 'Object';
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
  if (setupFile === '') {
    return;
  }

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
    // add set up env file
    // setupFilesAfterEnv
    const existingSetupFiles = getPropertyValueInJestConfig(
      host,
      jestConfig,
      'setupFilesAfterEnv'
    );

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

    // check if jest config has babel transform
    const transformProperty = getPropertyValueInJestConfig(
      host,
      jestConfig,
      'transform'
    );

    let hasBabelTransform = false;
    if (checkJestPropertyObject(transformProperty)) {
      for (const prop in transformProperty) {
        const transformPropValue = transformProperty[prop];
        if (Array.isArray(transformPropValue)) {
          hasBabelTransform = transformPropValue.some((value) =>
            value.includes('babel')
          );
        } else if (typeof transformPropValue === 'string') {
          transformPropValue.includes('babel');
        }
      }
    }
    if (hasBabelTransform) {
      return;
    }

    const existingGlobalTsJest = getPropertyValueInJestConfig(
      host,
      jestConfig,
      'globals.ts-jest'
    );
    if (!checkJestPropertyObject(existingGlobalTsJest)) {
      addPropertyToJestConfig(host, jestConfig, 'globals', {
        'ts-jest': globalTsJest,
      });
    }
  } catch {
    context.logger.warn(`
    Cannot update jest config for the ${project} project. 
    This is most likely caused because the jest config at ${jestConfig} it not in a expected configuration format (ie. module.exports = {}).
    
    Since this migration could not be ran on this project, please make sure to modify the Jest config file to have the following configured:
    * setupFilesAfterEnv with: ${setupFile}
    * globals.ts-jest with:   ${serializeJson(globalTsJest)}
  `);
  }
}

function updateJestConfigForProjects() {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host, getWorkspacePath(host));

    for (const [projectName, projectDefinition] of workspace.projects) {
      // skip projects that do not have test
      if (!projectDefinition.targets.has('test')) {
        return;
      }

      const testTarget = projectDefinition.targets.get('test');

      // skip projects that are not using the jest builder
      if (testTarget.builder !== '@nrwl/jest:jest') {
        return;
      }

      // check if the project is angular so that we can place specific angular configs
      const isAngular = projectDefinition.targets
        .get('build')
        ?.builder.includes('@angular-devkit/build-angular');

      const setupfile = (testTarget.options?.setupFile as string) ?? '';
      const setupFileWithRootDir = setupfile.replace(
        projectDefinition.root,
        '<rootDir>'
      );
      const jestConfig = (testTarget.options?.jestConfig as string) ?? '';
      const tsConfig = (testTarget.options?.tsConfig as string) ?? '';
      const tsConfigWithRootDir = tsConfig.replace(
        projectDefinition.root,
        '<rootDir>'
      );

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

    return updateWorkspace(workspace);
  };
}

export default function update(): Rule {
  return chain([updateJestConfigForProjects(), formatFiles()]);
}
