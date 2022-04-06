type scrollBehaviorOptions = false | 'center' | 'top' | 'bottom' | 'nearest';

/**
 * Duplicate of Cypress.Config cypress config
 * because when referencing the cypress types it breaks jest tests
 */
export interface InternalResolvedConfigOptions<ComponentDevServerOpts = any> {
  baseUrl: string | null;
  env: { [key: string]: any };
  excludeSpecPattern: string | string[];
  numTestsKeptInMemory: number;
  port: number | null;
  reporter: string;
  reporterOptions: { [key: string]: any };
  slowTestThreshold: number;
  watchForFileChanges: boolean;
  defaultCommandTimeout: number;
  execTimeout: number;
  pageLoadTimeout: number;
  requestTimeout: number;
  responseTimeout: number;
  taskTimeout: number;
  fileServerFolder: string;
  fixturesFolder: string | false;
  integrationFolder: string;
  downloadsFolder: string;
  nodeVersion: 'system' | 'bundled';
  pluginsFile: string | false;
  redirectionLimit: number;
  resolvedNodePath: string;
  resolvedNodeVersion: string;
  screenshotOnRunFailure: boolean;
  screenshotsFolder: string | false;
  supportFile: string | false;
  videosFolder: string;
  trashAssetsBeforeRuns: boolean;
  videoCompression: number | false;
  video: boolean;
  videoUploadOnPasses: boolean;
  chromeWebSecurity: boolean;
  viewportHeight: number;
  viewportWidth: number;
  animationDistanceThreshold: number;
  waitForAnimations: boolean;
  scrollBehavior: scrollBehaviorOptions;
  experimentalSessionSupport: boolean;
  experimentalInteractiveRunEvents: boolean;
  experimentalSourceRewriting: boolean;
  experimentalStudio: boolean;
  includeShadowDom: boolean;
  blockHosts: null | string | string[];
  componentFolder: false | string;
  projectId: null | string;
  supportFolder: string;
  specPattern: string | string[];
  userAgent: null | string;
  experimentalFetchPolyfill: boolean;
  component: ComponentConfigOptions<ComponentDevServerOpts>;
  e2e: CoreConfigOptions;
}

interface ComponentConfigOptions<ComponentDevServerOpts = any>
  extends CoreConfigOptions {
  devServer: DevServerFn<ComponentDevServerOpts>;
  devServerConfig?: ComponentDevServerOpts;
}

type CoreConfigOptions = Partial<
  Omit<InternalResolvedConfigOptions, TestingType>
>;

type DevServerFn<ComponentDevServerOpts = any> = (
  cypressDevServerConfig: any,
  devServerConfig: ComponentDevServerOpts
) => InternalResolvedConfigOptions | Promise<InternalResolvedConfigOptions>;
type TestingType = 'e2e' | 'component';
