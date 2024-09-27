import * as chalk from 'chalk';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { output } from '../output';
import { getPackageManagerCommand } from '../package-manager';
import { workspaceRoot } from '../workspace-root';
import { CORE_PLUGINS } from './core-plugins';
import {
  PluginCapabilities,
  getPluginCapabilities,
} from './plugin-capabilities';
import { readModulePackageJson } from '../package-json';

export function listPlugins(
  plugins: Map<string, PluginCapabilities>,
  title: string
) {
  readModulePackageJson;
  const bodyLines: string[] = [];

  for (const [, p] of plugins) {
    const capabilities = [];
    if (hasElements(p.executors)) {
      capabilities.push('executors');
    }
    if (hasElements(p.generators)) {
      capabilities.push('generators');
    }
    if (p.projectGraphExtension) {
      capabilities.push('graph-extension');
    }
    if (p.projectInference) {
      capabilities.push('project-inference');
    }
    bodyLines.push(
      `${chalk.bold(p.name)} ${
        capabilities.length >= 1 ? `(${capabilities.join()})` : ''
      }`
    );
  }

  output.log({
    title: title,
    bodyLines: bodyLines,
  });
}

export function listAlsoAvailableCorePlugins(
  installedPlugins: Map<string, PluginCapabilities>
): void {
  const alsoAvailable = CORE_PLUGINS.filter(
    (p) => !installedPlugins.has(p.name)
  );

  if (alsoAvailable.length) {
    output.log({
      title: `Also available:`,
      bodyLines: alsoAvailable.map((p) => {
        return `${chalk.bold(p.name)} (${p.capabilities})`;
      }),
    });
  }
}

export function listPowerpackPlugins(): void {
  const powerpackLink = 'https://nx.dev/plugin-registry#powerpack';
  output.log({
    title: `Available Powerpack Plugins: ${powerpackLink}`,
  });
}

export async function listPluginCapabilities(
  pluginName: string,
  projects: Record<string, ProjectConfiguration>
) {
  const plugin = await getPluginCapabilities(
    workspaceRoot,
    pluginName,
    projects
  );

  if (!plugin) {
    const pmc = getPackageManagerCommand();
    output.note({
      title: `${pluginName} is not currently installed`,
      bodyLines: [
        `Use "${pmc.addDev} ${pluginName}" to install the plugin.`,
        `After that, use "${pmc.exec} nx g ${pluginName}:init" to add the required peer deps and initialize the plugin.`,
      ],
    });

    return;
  }

  const hasBuilders = hasElements(plugin.executors);
  const hasGenerators = hasElements(plugin.generators);
  const hasProjectGraphExtension = !!plugin.projectGraphExtension;
  const hasProjectInference = !!plugin.projectInference;

  if (
    !hasBuilders &&
    !hasGenerators &&
    !hasProjectGraphExtension &&
    !hasProjectInference
  ) {
    output.warn({ title: `No capabilities found in ${pluginName}` });
    return;
  }

  const bodyLines = [];

  if (hasGenerators) {
    bodyLines.push(chalk.bold(chalk.green('GENERATORS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.generators).map(
        (name) => `${chalk.bold(name)} : ${plugin.generators[name].description}`
      )
    );
    if (hasBuilders) {
      bodyLines.push('');
    }
  }

  if (hasBuilders) {
    bodyLines.push(chalk.bold(chalk.green('EXECUTORS/BUILDERS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.executors).map((name) => {
        const definition = plugin.executors[name];
        return typeof definition === 'string'
          ? chalk.bold(name)
          : `${chalk.bold(name)} : ${definition.description}`;
      })
    );
  }

  if (hasProjectGraphExtension) {
    bodyLines.push(`✔️  Project Graph Extension`);
  }

  if (hasProjectInference) {
    bodyLines.push(`✔️  Project Inference`);
  }

  output.log({
    title: `Capabilities in ${plugin.name}:`,
    bodyLines,
  });
}

function hasElements(obj: any): boolean {
  return obj && Object.values(obj).length > 0;
}
