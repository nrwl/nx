export type BudgetEntry = {
  type:
    | 'all'
    | 'allScript'
    | 'any'
    | 'anyScript'
    | 'anyComponentStyle'
    | 'bundle'
    | 'initial';
  name?: string;
  baseline?: string;
  maximumWarning?: string;
  maximumError?: string;
  minimumWarning?: string;
  minimumError?: string;
  warning?: string;
  error?: string;
};

export interface DevServerUnsupportedOptions {
  headers?: Record<string, string>;
  open?: boolean;
  liveReload?: boolean;
  servePath?: string;
  hmr?: boolean;
  inspect?: string | boolean;
  prebundle?:
    | boolean
    | {
        exclude: string[];
      };
}

export interface PluginUnsupportedOptions {
  deployUrl?: string;
  security?: {
    autoCsp?:
      | boolean
      | {
          unsafeEval?: boolean;
        };
  };
  externalDependencies?: string[];
  clearScreen?: boolean;
  baseHref?: string;
  verbose?: boolean;
  progress?: boolean;
  i18nMissingTranslation?: 'warning' | 'error' | 'ignore';
  i18nDuplicateTranslation?: 'warning' | 'error' | 'ignore';
  localize?: boolean | string[];
  watch?: boolean;
  poll?: number;
  deleteOutputPath?: boolean;
  preserveSymlinks?: boolean;
  subresourceIntegrity?: boolean;
  serviceWorker?: string | false;
  statsJson?: boolean;
  budgets?: BudgetEntry[];
  webWorkerTsConfig?: string;
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  allowedCommonJsDependencies?: string[];
  prerender?:
    | boolean
    | {
        routesFile?: string;
        discoverRoutes?: boolean;
      };
  appShell?: boolean;
  outputMode?: 'static' | 'server';
}

export const TOP_LEVEL_OPTIONS_PENDING_SUPPORT = [
  'deployUrl',
  'security',
  'externalDependencies',
  'clearScreen',
  'baseHref',
  'verbose',
  'progress',
  'i18nMissingTranslation',
  'i18nDuplicateTranslation',
  'localize',
  'watch',
  'poll',
  'deleteOutputPath',
  'preserveSymlinks',
  'subresourceIntegrity',
  'serviceWorker',
  'statsJson',
  'budgets',
  'webWorkerTsConfig',
  'crossOrigin',
  'allowedCommonJsDependencies',
  'prerender',
  'appShell',
  'outputMode',
];

export const DEV_SERVER_OPTIONS_PENDING_SUPPORT = [
  'headers',
  'open',
  'liveReload',
  'servePath',
  'hmr',
  'inspect',
  'prebundle',
];
