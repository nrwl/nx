import type { Agent } from '../utils';

export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  packageVersion?: string;
  agents?: Agent[];
};

export type NormalizedSetupAiAgentsGeneratorSchema =
  Required<SetupAiAgentsGeneratorSchema>;
