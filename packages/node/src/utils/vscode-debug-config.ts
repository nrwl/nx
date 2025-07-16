import {
  Tree,
  writeJson,
  updateJson,
  getPackageManagerCommand,
  readProjectConfiguration,
} from '@nx/devkit';

function findFreeDebugPort(tree: Tree): number {
  let highestPort = 0;

  // Check existing launch.json configurations for used debug ports
  if (tree.exists('.vscode/launch.json')) {
    try {
      const launchConfig = JSON.parse(
        tree.read('.vscode/launch.json', 'utf-8')
      );
      if (launchConfig.configurations) {
        for (const config of launchConfig.configurations) {
          if (config.env && config.env.NODE_OPTIONS) {
            const match = config.env.NODE_OPTIONS.match(/--inspect=(\d+)/);
            if (match) {
              const currentPort = parseInt(match[1]);
              highestPort = Math.max(highestPort, currentPort);
            }
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Return the next available port after the highest used port, or 9229 if none are used
  return highestPort > 0 ? highestPort + 1 : 9229;
}

export interface VSCodeDebugConfigOptions {
  projectName: string;
  projectRoot: string;
  packageManager?: string;
}

export function addVSCodeDebugConfiguration(
  tree: Tree,
  options: VSCodeDebugConfigOptions
): void {
  const pmCommand = getPackageManagerCommand().exec;

  // Determine the output path based on project configuration
  let outputPath: string;

  try {
    const projectConfig = readProjectConfiguration(tree, options.projectName);
    outputPath = projectConfig.targets?.build?.options?.outputPath;
  } catch {
    outputPath = undefined;
  }

  // If no outputPath is configured, assume it's in the project directory
  if (!outputPath) {
    outputPath = `${options.projectRoot}/dist`;
  }

  // Find a free debug port to avoid conflicts
  const debugPort = findFreeDebugPort(tree);

  const debugConfig = {
    type: 'node',
    request: 'launch',
    name: `Debug ${options.projectName} with Nx`,
    runtimeExecutable: pmCommand,
    runtimeArgs: ['nx', 'serve', options.projectName],
    env: {
      NODE_OPTIONS: `--inspect=${debugPort}`,
    },
    console: 'integratedTerminal',
    internalConsoleOptions: 'neverOpen',
    skipFiles: ['<node_internals>/**'],
    sourceMaps: true,
    outFiles: [
      `\${workspaceFolder}/${outputPath}/**/*.(m|c|)js`,
      '!**/node_modules/**',
    ],
  };

  if (!tree.exists('.vscode/launch.json')) {
    // Create launch.json with the configuration
    writeJson(tree, '.vscode/launch.json', {
      version: '0.2.0',
      configurations: [debugConfig],
    });
  } else {
    // Add configuration to existing launch.json
    updateJson(tree, '.vscode/launch.json', (json) => {
      if (!json.configurations) {
        json.configurations = [];
      }
      json.configurations.push(debugConfig);
      return json;
    });
  }
}
