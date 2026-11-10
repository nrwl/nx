export interface Schema {
  project: string;
  appId?: string;
  main?: string;
  serverFileName?: string;
  serverPort?: number;
  rootModuleFileName?: string;
  rootModuleClassName?: string;
  standalone?: boolean;
  hydration?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  /**
   * Internal. The project's build is converted to `@nx/angular-rspack` right
   * after this generator runs, so the setup must match what the rspack build
   * supports rather than the build executor the project has right now.
   */
  isRspack?: boolean;
}

export interface NormalizedGeneratorOptions extends Schema {
  isUsingApplicationBuilder: boolean;
  isUsingWebpackBuilder: boolean;
  buildTargetExecutor: string;
  buildTargetTsConfigPath: string;
}
