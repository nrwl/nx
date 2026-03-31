export type SourceInformation = [file: string | null, plugin: string];
export type ConfigurationSourceMaps = Record<
  string,
  Record<string, SourceInformation>
>;
