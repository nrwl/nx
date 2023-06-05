// command to run https://github.com/expo/eas-cli/tree/main#eas-build
// options from github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/build/index.ts
export interface ExpoEasBuildOptions {
  platform: 'ios' | 'android' | 'all';
  profile?: string;
  interactive: boolean; // default is true
  local: boolean; // default is false
  output?: string;
  wait: boolean; // default is true
  clearCache: boolean; // default is false
  json: boolean; // default is false
  autoSubmit: boolean; // default is false
  autoSubmitWithProfile?: string;
}
