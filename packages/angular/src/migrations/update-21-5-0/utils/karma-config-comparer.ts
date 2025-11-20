/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Adapts the private utility from Angular CLI to be used in the migration.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  analyzeKarmaConfig,
  type KarmaConfigAnalysis,
  type KarmaConfigValue,
} from './karma-config-analyzer';

/**
 * Represents the difference between two Karma configurations.
 */
export interface KarmaConfigDiff {
  /** A map of settings that were added in the project's configuration. */
  added: Map<string, KarmaConfigValue>;

  /** A map of settings that were removed from the project's configuration. */
  removed: Map<string, KarmaConfigValue>;

  /** A map of settings that were modified between the two configurations. */
  modified: Map<
    string,
    { projectValue: KarmaConfigValue; defaultValue: KarmaConfigValue }
  >;

  /** A boolean indicating if the comparison is reliable (i.e., no unsupported values were found). */
  isReliable: boolean;
}

/**
 * Generates the default Karma configuration file content as a string.
 * @param relativePathToWorkspaceRoot The relative path from the Karma config file to the workspace root.
 * @param projectName The name of the project.
 * @param needDevkitPlugin A boolean indicating if the devkit plugin is needed.
 * @returns The content of the default `karma.conf.js` file.
 */
export async function generateDefaultKarmaConfig(
  relativePathToWorkspaceRoot: string,
  projectName: string,
  needDevkitPlugin: boolean
): Promise<string> {
  let template = await getKarmaConfigTemplate();

  // TODO: Replace this with the actual schematic templating logic.
  template = template
    .replace(
      /<%= relativePathToWorkspaceRoot %>/g,
      normalize(relativePathToWorkspaceRoot).replace(/\\/g, '/')
    )
    .replace(/<%= folderName %>/g, projectName);

  const devkitPluginRegex = /<% if \(needDevkitPlugin\) { %>(.*?)<% } %>/gs;
  const replacement = needDevkitPlugin ? '$1' : '';
  template = template.replace(devkitPluginRegex, replacement);

  return template;
}

/**
 * Compares two Karma configuration analyses and returns the difference.
 * @param projectAnalysis The analysis of the project's configuration.
 * @param defaultAnalysis The analysis of the default configuration to compare against.
 * @returns A diff object representing the changes between the two configurations.
 */
export function compareKarmaConfigs(
  projectAnalysis: KarmaConfigAnalysis,
  defaultAnalysis: KarmaConfigAnalysis
): KarmaConfigDiff {
  const added = new Map<string, KarmaConfigValue>();
  const removed = new Map<string, KarmaConfigValue>();
  const modified = new Map<
    string,
    { projectValue: KarmaConfigValue; defaultValue: KarmaConfigValue }
  >();

  const allKeys = new Set([
    ...projectAnalysis.settings.keys(),
    ...defaultAnalysis.settings.keys(),
  ]);

  for (const key of allKeys) {
    const projectValue = projectAnalysis.settings.get(key);
    const defaultValue = defaultAnalysis.settings.get(key);

    if (projectValue !== undefined && defaultValue === undefined) {
      added.set(key, projectValue);
    } else if (projectValue === undefined && defaultValue !== undefined) {
      removed.set(key, defaultValue);
    } else if (projectValue !== undefined && defaultValue !== undefined) {
      if (!isDeepStrictEqual(projectValue, defaultValue)) {
        modified.set(key, { projectValue, defaultValue });
      }
    }
  }

  return {
    added,
    removed,
    modified,
    isReliable:
      !projectAnalysis.hasUnsupportedValues &&
      !defaultAnalysis.hasUnsupportedValues,
  };
}

/**
 * Checks if there are any differences in the provided Karma configuration diff.
 * @param diff The Karma configuration diff object to check.
 * @returns True if there are any differences; false otherwise.
 */
export function hasDifferences(diff: KarmaConfigDiff): boolean {
  return diff.added.size > 0 || diff.removed.size > 0 || diff.modified.size > 0;
}

/**
 * Compares a project's Karma configuration with the default configuration.
 * @param projectConfigContent The content of the project's `karma.conf.js` file.
 * @param projectRoot The root directory of the project.
 * @param needDevkitPlugin A boolean indicating if the devkit plugin is needed for the default config.
 * @param karmaConfigPath The path to the Karma configuration file, used to resolve relative paths.
 * @returns A diff object representing the changes.
 */
export async function compareKarmaConfigToDefault(
  projectConfigContent: string,
  projectName: string,
  karmaConfigPath: string,
  needDevkitPlugin: boolean
): Promise<KarmaConfigDiff>;

/**
 * Compares a project's Karma configuration with the default configuration.
 * @param projectAnalysis The analysis of the project's configuration.
 * @param projectRoot The root directory of the project.
 * @param needDevkitPlugin A boolean indicating if the devkit plugin is needed for the default config.
 * @param karmaConfigPath The path to the Karma configuration file, used to resolve relative paths.
 * @returns A diff object representing the changes.
 */
export async function compareKarmaConfigToDefault(
  projectAnalysis: KarmaConfigAnalysis,
  projectName: string,
  karmaConfigPath: string,
  needDevkitPlugin: boolean
): Promise<KarmaConfigDiff>;

export async function compareKarmaConfigToDefault(
  projectConfigOrAnalysis: string | KarmaConfigAnalysis,
  projectName: string,
  karmaConfigPath: string,
  needDevkitPlugin: boolean
): Promise<KarmaConfigDiff> {
  const projectAnalysis =
    typeof projectConfigOrAnalysis === 'string'
      ? analyzeKarmaConfig(projectConfigOrAnalysis)
      : projectConfigOrAnalysis;

  const defaultContent = await generateDefaultKarmaConfig(
    relativePathToWorkspaceRoot(dirname(karmaConfigPath)),
    projectName,
    needDevkitPlugin
  );
  const defaultAnalysis = analyzeKarmaConfig(defaultContent);

  return compareKarmaConfigs(projectAnalysis, defaultAnalysis);
}

function relativePathToWorkspaceRoot(projectRoot: string | undefined): string {
  if (!projectRoot) {
    return '.';
  }

  return relative(join('/', projectRoot), '/') || '.';
}

const karmaConfigTemplateFallback = `// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'<% if (needDevkitPlugin) { %>, '@angular-devkit/build-angular'<% } %>],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),<% if (needDevkitPlugin) { %>
      require('@angular-devkit/build-angular/plugins/karma')<% } %>
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with \`random: false\`
        // or set a specific seed with \`seed: 4321\`
      },
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, '<%= relativePathToWorkspaceRoot %>/coverage/<%= folderName %>'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
`;

async function getKarmaConfigTemplate(): Promise<string> {
  try {
    const templatePath = require.resolve(
      '@schematics/angular/config/files/karma.conf.js.template'
    );
    return await readFile(templatePath, 'utf-8');
  } catch (e) {
    return karmaConfigTemplateFallback;
  }
}
