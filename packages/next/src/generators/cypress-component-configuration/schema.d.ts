export interface CypressComponentConfigurationGeneratorSchema {
  project: string;
  generateTests: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}
