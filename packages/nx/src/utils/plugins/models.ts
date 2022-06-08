import {
  ExecutorsJsonEntry,
  GeneratorsJsonEntry,
} from '../../config/misc-interfaces';

export interface PluginCapabilities {
  name: string;
  executors: { [name: string]: ExecutorsJsonEntry };
  generators: { [name: string]: GeneratorsJsonEntry };
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
