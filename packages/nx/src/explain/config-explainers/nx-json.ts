import type {
  ImplicitDependencyEntry,
  NxJsonConfiguration,
} from 'nx/src/config/nx-json';
import { ConfigExplainer } from '../config-explainer';

const NX_DEV_BASE_PATH = '/configuration/workspace-defaults-and-cli';

/**
 * The descriptions below should be kept in sync with their JSDoc counterparts on the config interface itself.
 * We have a utility in the unit tests to ensure that this is the case.
 */
export const nxConfigExplainer: ConfigExplainer<NxJsonConfiguration> = {
  extends: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#extends`,
    explainConfig: (extendsVal) => {
      if (!extendsVal) {
        return 'No custom config set, you could safely remove this section';
      }
      return `Your nx.json config is extending a base config found at: "${extendsVal}". This mean that anything set in your nx.json directly will override the equivalent setting in that base config.

If you want to inspect the base config you can run:

\`\`\`sh
npx nx explain ${extendsVal}
\`\`\``;
    },
  },
  implicitDependencies: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#files--implicit-dependencies`,
    explainConfig: (implicitDependencies) => {
      if (
        !implicitDependencies ||
        Object.keys(implicitDependencies).length === 0
      ) {
        return 'No custom config set, you could safely remove this section';
      }
      let output = `Your config instructs Nx's project graph creation logic of the following:`;

      const getAffectedProjectText = (affectedProjects) => {
        if (affectedProjects === '*') {
          return 'all projects';
        }
        if (Array.isArray(affectedProjects)) {
          const projects = affectedProjects as string[];
          if (projects.length === 0) {
            return;
          }
          if (projects.length === 1) {
            return `the project \`${projects[0]}\``;
          }
          return `the projects ${projects.map((s) => `\`${s}\``).join(', ')}`;
        }
        return `the project \`${affectedProjects}\``;
      };

      function applyImplicitlyAffectedProjectsText(
        input: ImplicitDependencyEntry,
        parentKey = '',
        parentVal: ImplicitDependencyEntry | undefined,
        parentJSONFile = ''
      ) {
        if (!parentVal) {
          parentVal = input;
        }

        for (const [fileOrPattern, affectedProjects] of Object.entries(input)) {
          const fileOrPatternIncludingParent = [parentKey, fileOrPattern]
            .filter(Boolean)
            .join('.');

          if (
            typeof affectedProjects === 'string' ||
            Array.isArray(affectedProjects)
          ) {
            const implicitlyAffectedProjectsText =
              getAffectedProjectText(affectedProjects);

            if (fileOrPattern.includes('*')) {
              output += `\n\n  - Changes to any ${
                parentJSONFile ? 'JSON fields' : 'files'
              } matching the pattern \`${fileOrPatternIncludingParent}\` ${
                parentJSONFile ? `within ${parentJSONFile} ` : ''
              }should affect ${implicitlyAffectedProjectsText}`;
            } else {
              output += `\n\n  - Changes to \`${fileOrPatternIncludingParent}\` ${
                parentJSONFile ? `within ${parentJSONFile} ` : ''
              }should affect ${implicitlyAffectedProjectsText}`;
            }

            continue;
          }

          // Keys (or patterns of keys) within JSON files affecting projects
          if (
            typeof affectedProjects === 'object' &&
            affectedProjects !== null
          ) {
            const isTopLevelOfJsonFile = fileOrPattern.endsWith('.json');
            const keyIncludingParent = [
              parentKey,
              isTopLevelOfJsonFile ? '' : fileOrPattern,
            ]
              .filter(Boolean)
              .join('.');

            applyImplicitlyAffectedProjectsText(
              affectedProjects,
              keyIncludingParent,
              input,
              isTopLevelOfJsonFile ? fileOrPattern : parentJSONFile
            );
          }
        }
      }

      applyImplicitlyAffectedProjectsText(
        implicitDependencies,
        undefined,
        undefined,
        undefined
      );

      return output;
    },
  },
  targetDependencies: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#target-dependencies`,
    explainConfig: (targetDependencies) => {
      if (Object.keys(targetDependencies).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }

      let output = `Your config instructs Nx's task graph creation logic of the following:`;

      for (const [targetName, dependencies] of Object.entries(
        targetDependencies
      )) {
        output += `\n\n  - For any given project, before executing a target called \`${targetName}\` Nx should first execute:`;

        for (const dependency of dependencies) {
          if (dependency.projects === 'self') {
            output += `\n    - The project's own target called \`${dependency.target}\``;
          }
          if (dependency.projects === 'dependencies') {
            output += `\n    - A target called \`${dependency.target}\` on any of the project's dependencies which implement that target`;
          }
        }
      }

      return output;
    },
  },
  npmScope: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#npm-scope`,
    explainConfig: (npmScope) => {
      if (!npmScope) {
        return 'No custom config set, you could safely remove this section';
      }
      return `When you generate a new library, e.g. \`my-lib\`, your npmScope value of \`${npmScope}\` will be used when generating the appropriate TypeScript path mappings in your workspace's root tsconfig, such that you can then import any exported symbols from your new library's \`index.ts\` file using \`@${npmScope}/my-lib\` like so:
  
  libs/my-lib/index.ts
  \`\`\`ts
  export { SomeExportedThing } from './lib/something.ts';
  \`\`\`
  
  (within any other workspace app or lib)
  \`\`\`ts
  import { SomeExportedThing } from '@${npmScope}/my-lib';
  \`\`\``;
    },
  },
  affected: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#affected`,
    explainConfig: (affected) => {
      if (!affected || !affected.defaultBase) {
        return 'No custom config set, you could safely remove this section';
      }
      return `You have configured a \`defaultBase\` value of \`${affected.defaultBase}\`, which means that whenever you run an affected command such as \`nx affected:build\`, it is the same as if you had run \`nx affected:build --base=${affected.defaultBase}\``;
    },
  },
  workspaceLayout: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#workspace-layout`,
    explainConfig: (workspaceLayout) => {
      if (!workspaceLayout || Object.keys(workspaceLayout).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }
      const outputIntro = `Generators provided by Nx plugins will use this configuration as a reference point to know where to place projects relative to when creating or moving them. In your case:`;
      let output = outputIntro;

      if (typeof workspaceLayout.appsDir === 'string') {
        workspaceLayout.appsDir = workspaceLayout.appsDir || '.';
        output += `\n\n   - If you were to run \`nx g app my-app\`, the new application would be created at: \`${workspaceLayout.appsDir}/my-app\``;
      }

      if (typeof workspaceLayout.libsDir === 'string') {
        workspaceLayout.libsDir = workspaceLayout.libsDir || '.';
        output += `\n\n   - If you were to run \`nx g lib my-lib\`, the new library would be created at: \`${workspaceLayout.libsDir}/my-lib\``;
      }

      if (output === outputIntro) {
        output =
          'WARNING: You have added some custom config which is not supported by Nx, this will be ignored';
      } else {
        output +=
          '\n\nNOTE: For those generators which support controlling the `directory`, e.g. via a `--directory` flag, that specified directory will also be relative to the specified `appsDir` or `libsDir`';

        if (typeof workspaceLayout.appsDir === 'string') {
          workspaceLayout.appsDir = workspaceLayout.appsDir || '.';
          output += `\n\n   - E.g. \`nx g app my-app --directory=sub-dir\` => \`${workspaceLayout.appsDir}/sub-dir/my-app\``;
        }

        if (typeof workspaceLayout.libsDir === 'string') {
          workspaceLayout.libsDir = workspaceLayout.libsDir || '.';
          output += `\n\n   - E.g. \`nx g lib my-lib --directory=sub-dir\` => \`${workspaceLayout.libsDir}/sub-dir/my-lib\``;
        }
      }

      return output;
    },
  },
  tasksRunnerOptions: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#tasks-runner-options`,
    explainConfig: (tasksRunnerOptions) => {
      if (Object.keys(tasksRunnerOptions).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }

      let output = '';
      const allRunners = Object.entries(tasksRunnerOptions);
      const usesNxCloud = allRunners.some(
        ([_, runnerConfig]) => runnerConfig.runner === '@nrwl/nx-cloud'
      );

      if (allRunners.length === 1) {
        output += `Your \`${allRunners[0][0]}\` task runner is using the \`${allRunners[0][1].runner}\` runner.`;
      } else {
        output += `You have configured the following ${allRunners.length} Nx task runners:`;

        for (const [runnerName, runnerConfig] of Object.entries(
          tasksRunnerOptions
        )) {
          output += `\n\n  - \`${runnerName}\` using runner \`${runnerConfig.runner}\``;
        }
      }

      if (!usesNxCloud) {
        output += `\n\nP.S. Have you considered enabling Nx Cloud? It's free for most workspaces. Learn how to add Nx Cloud to your workspace here: https://nx.app/docs/add-nx-cloud-to-workspace#adding-nx-cloud-to-an-existing-workspace`;
      }

      return output;
    },
  },
  generators: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#generators`,
    explainConfig: (generatorsConfig) => {
      if (!generatorsConfig || Object.keys(generatorsConfig).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }
      let output = ``;

      const createGenerateConfigOutput = (
        collectionName: string,
        generatorName: string,
        generatorConfig: any
      ) => {
        let output = `You are instructing the generator \`${collectionName}:${generatorName}\` to use the following settings by default:`;
        for (const [key, value] of Object.entries(generatorConfig)) {
          output += `\n\n   \`${key}\` is set to \`${JSON.stringify(value)}\``;
        }
        return output;
      };

      let hasFirstOutputLine = false;

      Object.entries(generatorsConfig).forEach(
        ([collectionOrGeneratorSpecifier, collectionOrGeneratorConfig], i) => {
          const separatorIndex =
            collectionOrGeneratorSpecifier.lastIndexOf(':');
          let collectionName = collectionOrGeneratorSpecifier;
          let generatorName = '';
          if (separatorIndex > 0) {
            collectionName = collectionOrGeneratorSpecifier.slice(
              0,
              separatorIndex
            );
            generatorName = collectionOrGeneratorSpecifier.slice(
              separatorIndex + 1
            );

            output +=
              (!hasFirstOutputLine ? '' : '\n\n→ ') +
              createGenerateConfigOutput(
                collectionName,
                generatorName,
                collectionOrGeneratorConfig
              );
            hasFirstOutputLine = true;
          } else {
            Object.entries(collectionOrGeneratorConfig).forEach(
              ([generatorName, generatorConfig], j) => {
                output +=
                  (!hasFirstOutputLine ? '' : '\n\n→ ') +
                  createGenerateConfigOutput(
                    collectionName,
                    generatorName,
                    generatorConfig
                  );
                hasFirstOutputLine = true;
              }
            );
          }
        }
      );
      output += `\n\nNOTE: These defaults can still be overridden when the generators are invoked.`;
      output += `\n\nPlease consult each generator's respective documentation for more information on the available settings`;
      return output;
    },
  },
  cli: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#cli-options`,
    explainConfig: (cli) => {
      if (!cli || Object.keys(cli).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }
      let output = '';

      if (typeof cli.defaultCollection !== 'undefined') {
        if (!cli.defaultCollection) {
          output += `You have set an empty value for \`defaultCollection\`, which means that a collection will always need to be specified when you run a generator command: e.g. \`nx generate @nrwl/react:application\` is fine (the collection is \`@nrwl/react\`) but \`nx generate application\` will error because it cannot know where to look for an appropriate \`application\` generator`;
        } else {
          output += `The default collection is set to \`${cli.defaultCollection}\`, which means that when you run a generator command such as \`nx generate application\` or \`nx g app\`, without an explicit collection, it is the same as if you had run \`nx generate ${cli.defaultCollection}:application\` or \`nx g ${cli.defaultCollection}:app\``;
        }
      }

      if (output.length === 0) {
        output =
          'WARNING: You have added some custom config which is not supported by Nx, this will be ignored';
      }

      return output;
    },
  },
  plugins: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#plugins`,
    explainConfig: (plugins) => {
      if (!plugins || (Array.isArray(plugins) && plugins.length === 0)) {
        return 'No custom config set, you could safely remove this section';
      }
      return `Whilst constructing the project graph in order to understand how all your workspace projects fit together, Nx will resolve the plugin ${
        plugins.length === 1 ? 'file' : 'files'
      } located at ${plugins.map((s) => `\`${s}\``).join(' and ')} and invoke ${
        plugins.length === 1 ? 'its' : 'their'
      } \`processProjectGraph()\` ${
        plugins.length === 1 ? 'method' : 'methods'
      } in order to influence the final graph it creates`;
    },
  },
  pluginsConfig: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#plugins-config`,
    explainConfig: (pluginsConfig) => {
      if (!pluginsConfig || Object.keys(pluginsConfig).length === 0) {
        return 'No custom config set, you could safely remove this section';
      }
      let output = ``;
      Object.entries(pluginsConfig).forEach(([name, config], i) => {
        output +=
          (i === 0 ? '' : '\n\n→ ') +
          `You are passing the following settings to the plugin \`${name}\`:`;
        for (const [key, value] of Object.entries(config)) {
          output += `\n\n   - \`${key}\` is set to \`${JSON.stringify(
            value
          )}\``;
        }
      });
      output += `\n\nPlease consult each plugin's respective documentation for more information on the available settings`;
      return output;
    },
  },
  defaultProject: {
    nxDevLearnMorePath: `${NX_DEV_BASE_PATH}#default-project`,
    explainConfig: (defaultProject) => {
      if (!defaultProject) {
        return 'You have set an empty value for `defaultProject` which means that a project name will always need to be specified when running Nx target/run commands such as `nx build` or `nx run build`, and the CLI will appropriately error if you do not';
      }
      return `You have configured a \`defaultProject\` value of \`${defaultProject}\`, which means that whenever you run an Nx target/run command such as \`nx build\` or \`nx run build\`, without an explicit project name, it is the same as if you had run \`nx build ${defaultProject}\` or \`nx run ${defaultProject}:build\``;
    },
  },
};
