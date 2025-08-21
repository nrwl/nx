export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  writeNxCloudRules?: boolean;
  packageVersion?: string;
};

export type NormalizedSetupAiAgentsGeneratorSchema =
  Required<SetupAiAgentsGeneratorSchema>;
