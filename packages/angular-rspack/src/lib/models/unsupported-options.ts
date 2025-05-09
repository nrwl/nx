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
  inspect?: string | boolean;
  prebundle?:
    | boolean
    | {
        exclude: string[];
      };
}

export interface PluginUnsupportedOptions {
  budgets?: BudgetEntry[];
  appShell?: boolean;
}

export const TOP_LEVEL_OPTIONS_PENDING_SUPPORT = ['budgets', 'appShell'];

export const DEV_SERVER_OPTIONS_PENDING_SUPPORT = ['inspect', 'prebundle'];
