export interface ConfigurationGeneratorSchema {
  project: string;
  directory: string;
  js: boolean; // default is false
  skipFormat: boolean;
  skipPackageJson: boolean;
  /**
   * command to give playwright to run the web server
   * @example: "npx nx serve my-fe-app"
   **/
  webServerCommand?: string;
  /**
   * address
   * @example: "http://localhost:4200"
   **/
  webServerAddress?: string;
}
