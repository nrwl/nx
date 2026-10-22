import type { Agent } from '../utils';

export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  /**
   * @deprecated Nx no longer writes rules files. The option is accepted so
   * callers from older Nx versions keep working, and is ignored.
   */
  writeNxCloudRules?: boolean;
  packageVersion?: string;
  agents?: Agent[];
};

export type NormalizedSetupAiAgentsGeneratorSchema =
  Required<SetupAiAgentsGeneratorSchema>;
