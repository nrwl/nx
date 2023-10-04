// command to run https://github.com/expo/eas-cli/tree/main#eas-submit
// options from https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/submit.ts
export interface SubmitExecutorSchema {
  profile?: string;
  platform?: 'ios' | 'android' | 'all';
  id?: string;
  latest?: boolean;
  interactive: boolean; // default is true
  path?: string;
  url?: string;
  wait: boolean; // default is true
}
