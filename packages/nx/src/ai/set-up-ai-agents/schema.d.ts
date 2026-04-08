import type { Agent } from '../utils';

export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  writeNxCloudRules?: boolean;
  packageVersion?: string;
  agents?: Agent[];
};

export type NormalizedSetupAiAgentsGeneratorSchema =
  Required<SetupAiAgentsGeneratorSchema>;
