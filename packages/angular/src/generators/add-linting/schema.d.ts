export interface AddLintingGeneratorSchema {
  projectName: string;
  projectRoot: string;
  prefix: string;
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
}
