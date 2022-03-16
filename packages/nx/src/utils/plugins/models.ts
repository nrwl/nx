export interface PluginGenerator {
  factory: string;
  schema: string;
  description: string;
  aliases: string;
  hidden: boolean;
}

export interface PluginExecutor {
  implementation: string;
  schema: string;
  description: string;
}

export interface PluginCapabilities {
  name: string;
  executors: { [name: string]: PluginExecutor };
  generators: { [name: string]: PluginGenerator };
}

export interface CorePlugin {
  name: string;
  capabilities: 'executors' | 'generators' | 'executors,generators';
  link?: string;
}

export interface CommunityPlugin {
  name: string;
  url: string;
  description: string;
}
