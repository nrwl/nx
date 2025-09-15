export type SetupAiAgentsGeneratorSchema = {
  directory: string;
  writeNxCloudRules?: boolean;
  packageVersion?: string;
  agents: Agent[]
};

export type Agent = "claude"| "gemini"| "codex"| "cursor"| "copilot"

export type NormalizedSetupAiAgentsGeneratorSchema =
  Required<SetupAiAgentsGeneratorSchema>;
