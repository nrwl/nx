export interface CreateNodesGeneratorSchema {
  path: string;
  name?: string;
  targetName?: string;
  configFile?: string;
  skipReadme?: boolean;
  skipFormat?: boolean;
}
