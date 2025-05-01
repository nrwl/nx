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
  security?: {
    autoCsp?:
      | boolean
      | {
          unsafeEval?: boolean;
        };
  };
  clearScreen?: boolean;
  verbose?: boolean;
  progress?: boolean;
  watch?: boolean;
  poll?: number;
  statsJson?: boolean;
  budgets?: BudgetEntry[];
  allowedCommonJsDependencies?: string[];
  appShell?: boolean;
  outputMode?: 'static' | 'server';
}

export const TOP_LEVEL_OPTIONS_PENDING_SUPPORT = [
  'security',
  'clearScreen',
  'verbose',
  'progress',
  'watch',
  'poll',
  'statsJson',
  'budgets',
  'allowedCommonJsDependencies',
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
