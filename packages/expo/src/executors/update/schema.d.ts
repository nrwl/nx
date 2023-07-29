// command to run https://github.com/expo/eas-cli/tree/main#eas-update
// options from github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/update/index.ts
export interface ExpoEasUpdateOptions {
  branch?: string;
  message?: string;
  republish: boolean; // default is false
  group?: string;
  inputDir: string; // default is "dist"
  skipBundler: boolean; // default is false
  platform: 'ios' | 'android' | 'all'; // default is "all"
  json: boolean; // default is false
  auto: boolean; // default is false
  privateKeyPath?: string;
  interactive: boolean; // default is false
}
