export interface PluginSchematic {
  factory: string;
  schema: string;
  description: string;
  aliases: string;
  hidden: boolean;
}

export interface PluginBuilder {
  implementation: string;
  schema: string;
  description: string;
}

export interface PluginCapabilities {
  name: string;
  builders: { [name: string]: PluginBuilder };
  schematics: { [name: string]: PluginSchematic };
}

export interface CorePlugin {
  name: string;
  capabilities: 'builders' | 'schematics' | 'builders,schematics';
  link?: string;
}

export interface CommunityPlugin {
  name: string;
  url: string;
  description: string;
}
