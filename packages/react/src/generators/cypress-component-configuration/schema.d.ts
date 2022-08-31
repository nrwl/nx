export interface CypressComponentConfigurationSchema {
  project: string;
  generateTests: boolean;
  skipFormat?: boolean;
  buildTarget?: string;
}
