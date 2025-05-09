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
  open?: boolean;
  inspect?: string | boolean;
  prebundle?:
    | boolean
    | {
        exclude: string[];
      };
}

export interface PluginUnsupportedOptions {
  watch?: boolean;
  budgets?: BudgetEntry[];
  allowedCommonJsDependencies?: string[];
  appShell?: boolean;
}

export const TOP_LEVEL_OPTIONS_PENDING_SUPPORT = [
  'watch',
  'budgets',
  'allowedCommonJsDependencies',
  'appShell',
];

export const DEV_SERVER_OPTIONS_PENDING_SUPPORT = [
  'open',
  'inspect',
  'prebundle',
];
