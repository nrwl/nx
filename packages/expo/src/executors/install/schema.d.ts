// options from https://github.com/expo/expo/blob/main/packages/@expo/cli/src/install/index.ts

export interface ExpoInstallOptions {
  packages?: string | string[]; // either a string separated by comma or a string array
  check?: boolean; // default is false
  fix?: boolean; // default is false
}
