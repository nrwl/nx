import type { LinterType } from '@nx/js';

export interface ConfigurationGeneratorSchema {
  project: string;
  /**
   * this is relative to the projectRoot
   **/
  directory?: string;
  js?: boolean; // default is false
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipInstall?: boolean;
  linter?: LinterType;
  enableTypedLinting?: boolean; // default is false
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean; // default is false
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
  /**
   * command to run the web server when `CI` is set; defaults to `webServerCommand`
   * @example: "npx nx serve-static my-fe-app"
   **/
  ciWebServerCommand?: string;
  /**
   * address of the web server when `CI` is set; defaults to `webServerAddress`
   * @example: "http://localhost:4300"
   **/
  ciWebServerAddress?: string;
  rootProject?: boolean;
  addPlugin?: boolean;
}

export interface NormalizedGeneratorOptions extends ConfigurationGeneratorSchema {
  addPlugin: boolean;
  directory: string;
  linter: LinterType;
}
