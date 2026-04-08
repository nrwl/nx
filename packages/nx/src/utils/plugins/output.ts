import { join } from 'path';
import * as pc from 'picocolors';
import {
  ExecutorsJsonEntry,
  GeneratorsJsonEntry,
} from '../../config/misc-interfaces';
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
      `${pc.bold(p.name)} ${
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
        return `${pc.bold(p.name)} (${p.capabilities})`;
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
  projects: Record<string, ProjectConfiguration>,
  json = false
) {
  const plugin = await getPluginCapabilities(
    workspaceRoot,
    pluginName,
    projects
  );

  if (!plugin) {
    if (json) {
      console.log(JSON.stringify({ error: `${pluginName} is not installed` }));
      return;
    }
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
    if (json) {
      console.log(
        JSON.stringify({
          name: plugin.name,
          path: plugin.path,
          generators: {},
          executors: {},
          projectGraphExtension: false,
          projectInference: false,
        })
      );
      return;
    }
    output.warn({ title: `No capabilities found in ${pluginName}` });
    return;
  }

  if (json) {
    console.log(
      JSON.stringify(formatPluginCapabilitiesAsJson(plugin), null, 2)
    );
    return;
  }

  const bodyLines = [];

  if (plugin.path) {
    bodyLines.push(`${pc.bold('Path:')} ${plugin.path}`);
    bodyLines.push('');
  }

  if (hasGenerators) {
    bodyLines.push(pc.bold(pc.green('GENERATORS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.generators).map(
        (name) => `${pc.bold(name)} : ${plugin.generators[name].description}`
      )
    );
    if (hasBuilders) {
      bodyLines.push('');
    }
  }

  if (hasBuilders) {
    bodyLines.push(pc.bold(pc.green('EXECUTORS/BUILDERS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.keys(plugin.executors).map((name) => {
        const definition = plugin.executors[name];
        return typeof definition === 'string'
          ? pc.bold(name)
          : `${pc.bold(name)} : ${definition.description}`;
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

export function formatPluginCapabilitiesAsJson(plugin: PluginCapabilities) {
  const generators: Record<
    string,
    { description: string; path: string | null; schema: string | null }
  > = {};
  for (const [name, entry] of Object.entries(plugin.generators ?? {})) {
    generators[name] = {
      description: entry.description ?? '',
      path: resolveCapabilityPath(
        plugin.path,
        entry.factory ?? entry.implementation
      ),
      schema: resolveCapabilityPath(plugin.path, entry.schema),
    };
  }

  const executors: Record<
    string,
    { description: string; path: string | null; schema: string | null }
  > = {};
  for (const [name, entry] of Object.entries(plugin.executors ?? {})) {
    if (typeof entry === 'string') {
      executors[name] = { description: '', path: null, schema: null };
    } else {
      executors[name] = {
        description: entry.description ?? '',
        path: resolveCapabilityPath(plugin.path, entry.implementation),
        schema: resolveCapabilityPath(plugin.path, entry.schema),
      };
    }
  }

  return {
    name: plugin.name,
    path: plugin.path ?? null,
    generators,
    executors,
    projectGraphExtension: !!plugin.projectGraphExtension,
    projectInference: !!plugin.projectInference,
  };
}

export function formatPluginsAsJson(
  localPlugins: Map<string, PluginCapabilities>,
  installedPlugins: Map<string, PluginCapabilities>
) {
  function formatPluginSummary(plugin: PluginCapabilities) {
    const capabilities: string[] = [];
    if (hasElements(plugin.executors)) {
      capabilities.push('executors');
    }
    if (hasElements(plugin.generators)) {
      capabilities.push('generators');
    }
    if (plugin.projectGraphExtension) {
      capabilities.push('graph-extension');
    }
    if (plugin.projectInference) {
      capabilities.push('project-inference');
    }
    return {
      name: plugin.name,
      path: plugin.path ?? null,
      capabilities,
    };
  }

  return {
    localWorkspacePlugins: Array.from(localPlugins.values()).map(
      formatPluginSummary
    ),
    installedPlugins: Array.from(installedPlugins.values()).map(
      formatPluginSummary
    ),
  };
}

function resolveCapabilityPath(
  pluginPath: string | undefined,
  relativePath: string | undefined
): string | null {
  if (!pluginPath || !relativePath) {
    return null;
  }
  return join(pluginPath, relativePath);
}

function hasElements(obj: any): boolean {
  return obj && Object.values(obj).length > 0;
}
