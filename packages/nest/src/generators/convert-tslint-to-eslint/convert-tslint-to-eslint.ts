import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';
import { ConvertTSLintToESLintSchema, ProjectConverter } from '@nrwl/linter';
import {
  addLintingToApplication,
  NormalizedSchema as AddLintForApplicationSchema,
} from '@nrwl/node/src/generators/application/application';
import {
  addLint as addLintingToLibraryGenerator,
  NormalizedSchema as AddLintForLibrarySchema,
} from '@nrwl/workspace/src/generators/library/library';
import type { Linter } from 'eslint';

export async function conversionGenerator(
  host: Tree,
  options: ConvertTSLintToESLintSchema
) {
  /**
   * The ProjectConverter instance encapsulates all the standard operations we need
   * to perform in order to convert a project from TSLint to ESLint, as well as some
   * extensibility points for adjusting the behavior on a per package basis.
   *
   * E.g. @nrwl/angular projects might need to make different changes to the final
   * ESLint config when compared with @nrwl/nest projects.
   *
   * See the ProjectConverter implementation for a full breakdown of what it does.
   */
  const projectConverter = new ProjectConverter({
    host,
    projectName: options.project,
    eslintInitializer: async ({ projectName, projectConfig }) => {
      /**
       * Using .js is not an option with NestJS, so we always set it to false when
       * delegating to the external (more generic) generators below.
       */
      const js = false;

      if (projectConfig.projectType === 'application') {
        await addLintingToApplication(host, {
          linter: 'eslint' as any,
          name: projectName,
          appProjectRoot: projectConfig.root,
          js,
        } as AddLintForApplicationSchema);
      }

      if (projectConfig.projectType === 'library') {
        await addLintingToLibraryGenerator(host, {
          linter: 'eslint',
          name: projectName,
          projectRoot: projectConfig.root,
          js,
        } as AddLintForLibrarySchema);
      }
    },
  });

  /**
   * Dynamically install tslint-to-eslint-config to assist with the conversion.
   */
  projectConverter.installTSLintToESLintConfigPackage();

  /**
   * Create the standard (which is applicable to the current package) ESLint setup
   * for converting the project.
   */
  await projectConverter.initESLint();

  /**
   * Convert the root tslint.json and apply the converted rules to the root .eslintrc.json.
   */
  const rootConfigInstallTask = await projectConverter.convertRootTSLintConfig(
    (json) => removeCodelyzerRelatedRules(json)
  );

  /**
   * Convert the project's tslint.json to an equivalent ESLint config.
   */
  const projectConfigInstallTask = await projectConverter.convertProjectConfig(
    (json) => json
  );

  /**
   * Clean up the original TSLint configuration for the project.
   */
  projectConverter.removeProjectTSLintFile();

  /**
   * Store user preference regarding removeTSLintIfNoMoreTSLintTargets for the collection
   */
  projectConverter.setDefaults(
    '@nrwl/nest',
    options.removeTSLintIfNoMoreTSLintTargets
  );

  /**
   * Based on user preference and remaining usage, remove TSLint from the workspace entirely.
   */
  let uninstallTSLintTask: GeneratorCallback = () => Promise.resolve(undefined);
  if (
    options.removeTSLintIfNoMoreTSLintTargets &&
    !projectConverter.isTSLintUsedInWorkspace()
  ) {
    uninstallTSLintTask = projectConverter.removeTSLintFromWorkspace();
  }

  await formatFiles(host);

  return async () => {
    projectConverter.uninstallTSLintToESLintConfigPackage();
    await rootConfigInstallTask();
    await projectConfigInstallTask();
    await uninstallTSLintTask();
  };
}

export const conversionSchematic = convertNxGenerator(conversionGenerator);

/**
 * Remove any @angular-eslint rules that were applied as a result of converting prior codelyzer
 * rules, because they are only relevant for Angular projects.
 */
function removeCodelyzerRelatedRules(json: Linter.Config): Linter.Config {
  for (const ruleName of Object.keys(json.rules)) {
    if (ruleName.startsWith('@angular-eslint')) {
      delete json.rules[ruleName];
    }
  }
  return json;
}
