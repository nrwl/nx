import type { NxJsonConfiguration } from 'nx/src/config/nx-json';
import type { Tree } from 'nx/src/generators/tree';
import type {
  CreateNodes,
  CreateNodesFunction,
  CreateNodesResult,
} from 'nx/src/utils/nx-plugin';
import type { PackageJson } from 'nx/src/utils/package-json';
import { basename, dirname } from 'path';
import * as yargs from 'yargs-parser';
import { requireNx } from '../../nx';

const { glob, readJson, readNxJson, workspaceRoot, writeJson } = requireNx();

type TargetCommand = {
  command: string;
  target: string;
  configuration?: string;
};

export async function updatePackageScripts(
  tree: Tree,
  createNodesTuple: CreateNodes
): Promise<void> {
  const nxJson = readNxJson(tree);

  const [pattern, createNodes] = createNodesTuple;
  const files = glob(tree, [pattern]);

  for (const file of files) {
    const projectRoot = getProjectRootFromConfigFile(file);
    await processProject(tree, projectRoot, file, createNodes, nxJson);
  }
}

async function processProject(
  tree: Tree,
  projectRoot: string,
  projectConfigurationFile: string,
  createNodesFunction: CreateNodesFunction,
  nxJsonConfiguration: NxJsonConfiguration
) {
  const packageJsonPath = `${projectRoot}/package.json`;
  if (!tree.exists(packageJsonPath)) {
    return;
  }
  const packageJson = readJson<PackageJson>(tree, packageJsonPath);
  if (!packageJson.scripts || !Object.keys(packageJson.scripts).length) {
    return;
  }

  const result = await createNodesFunction(
    projectConfigurationFile,
    {},
    { nxJsonConfiguration, workspaceRoot }
  );

  const targetCommands = getInferredTargetCommands(result);
  if (!targetCommands.length) {
    return;
  }

  // exclude package.json scripts from nx
  packageJson.nx ??= {};
  packageJson.nx.includedScripts ??= [];

  for (const targetCommand of targetCommands) {
    const { command, target, configuration } = targetCommand;
    const targetCommandRegex = new RegExp(
      `(?<=^|&)((?: )*(?:[^&\\r\\n\\s]+ )*)(${command})((?: [^&\\r\\n\\s]+)*(?: )*)(?=$|&)`,
      'g'
    );
    for (const scriptName of Object.keys(packageJson.scripts)) {
      const script = packageJson.scripts[scriptName];
      // quick check for exact match within the script
      if (targetCommandRegex.test(script)) {
        packageJson.scripts[scriptName] = script.replace(
          targetCommandRegex,
          configuration
            ? `$1nx ${target} --configuration=${configuration}$3`
            : `$1nx ${target}$3`
        );
        excludeScriptFromPackageJson(packageJson, scriptName);
      } else {
        /**
         * Parse script and command to handle the following:
         * - if command doesn't match script                  => don't replace
         * - if command has more args                         => don't replace
         * - if command has same args, regardless of order    => replace removing args
         * - if command has less args or with different value => replace leaving args
         */
        const parsedCommand = yargs(command, {
          configuration: { 'strip-dashed': true },
        });

        // this assumes there are no positional args in the command, everything is a command or subcommand
        const commandCommand = parsedCommand._.join(' ');
        const commandRegex = new RegExp(
          `(?<=^|&)((?: )*(?:[^&\\r\\n\\s]+ )*)(${commandCommand})((?: [^&\\r\\n\\s]+)*( )*)(?=$|&)`,
          'g'
        );
        const matches = script.match(commandRegex);
        if (!matches) {
          // the command doesn't match the script, don't replace
          continue;
        }

        for (const match of matches) {
          // parse the matched command within the script
          const parsedScript = yargs(match, {
            configuration: { 'strip-dashed': true },
          });

          let hasArgsWithDifferentValues = false;
          let scriptHasExtraArgs = false;
          let commandHasExtraArgs = false;
          for (const [key, value] of Object.entries(parsedCommand)) {
            if (key === '_') {
              continue;
            }

            if (parsedScript[key] === undefined) {
              commandHasExtraArgs = true;
              break;
            }
            if (parsedScript[key] !== value) {
              hasArgsWithDifferentValues = true;
            }
          }

          if (commandHasExtraArgs) {
            // the command has extra args, don't replace
            continue;
          }

          for (const key of Object.keys(parsedScript)) {
            if (key === '_') {
              continue;
            }

            if (!parsedCommand[key]) {
              scriptHasExtraArgs = true;
              break;
            }
          }

          if (!hasArgsWithDifferentValues && !scriptHasExtraArgs) {
            // they are the same, replace with the command removing the args
            packageJson.scripts[scriptName] = packageJson.scripts[
              scriptName
            ].replace(
              match,
              match.replace(
                commandRegex,
                configuration
                  ? `$1nx ${target} --configuration=${configuration}$4`
                  : `$1nx ${target}$4`
              )
            );
          } else {
            // there are different args or the script has extra args, replace with the command leaving the args
            packageJson.scripts[scriptName] = packageJson.scripts[
              scriptName
            ].replace(
              match,
              match.replace(
                commandRegex,
                configuration
                  ? `$1nx ${target} --configuration=${configuration}$3`
                  : `$1nx ${target}$3`
              )
            );
          }

          excludeScriptFromPackageJson(packageJson, scriptName);
        }
      }
    }
  }

  writeJson(tree, packageJsonPath, packageJson);
}

function getInferredTargetCommands(result: CreateNodesResult): TargetCommand[] {
  const targetCommands: TargetCommand[] = [];

  for (const project of Object.values(result.projects ?? {})) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (target.command) {
        targetCommands.push({ command: target.command, target: targetName });
      } else if (
        target.executor === 'nx:run-commands' &&
        target.options?.command
      ) {
        targetCommands.push({
          command: target.options.command,
          target: targetName,
        });
      }

      if (!target.configurations) {
        continue;
      }

      for (const [configurationName, configuration] of Object.entries(
        target.configurations
      )) {
        if (configuration.command) {
          targetCommands.push({
            command: configuration.command,
            target: targetName,
            configuration: configurationName,
          });
        } else if (
          target.executor === 'nx:run-commands' &&
          configuration.options?.command
        ) {
          targetCommands.push({
            command: configuration.options.command,
            target: targetName,
            configuration: configurationName,
          });
        }
      }
    }
  }

  return targetCommands;
}

function excludeScriptFromPackageJson(
  packageJson: PackageJson,
  scriptName: string
) {
  packageJson.nx.includedScripts = packageJson.nx.includedScripts.filter(
    (s) => s !== scriptName
  );
}

function getProjectRootFromConfigFile(file: string): string {
  let projectRoot = dirname(file);
  if (basename(projectRoot) === '.storybook') {
    projectRoot = dirname(projectRoot);
  }

  return projectRoot;
}
