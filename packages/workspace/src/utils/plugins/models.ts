export interface PluginGenerator {
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
  generators: { [name: string]: PluginGenerator };
}

export interface CorePlugin {
  name: string;
  capabilities: 'builders' | 'generators' | 'builders,generators';
  link?: string;
}

export interface CommunityPlugin {
  name: string;
  url: string;
  description: string;
}
