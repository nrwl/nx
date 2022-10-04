/*
 * options from
 * - android: https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/android/resolveOptions.ts
 * - ios: https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/ios/options/resolveOptions.ts
 */
export interface ExpoRunOptions {
  platform: 'ios' | 'android';
  sync: boolean; // default is true

  // ios only
  scheme?: string | boolean; //  Xcode scheme to build.
  xcodeConfiguration?: XcodeConfiguration; // Xcode configuration to build. Default `Debug`

  // android only
  variant?: string;

  // shared between ios and android
  device?: string | boolean;
  port: number; // default is 8081
  bundler: boolean; // default is true
  install?: boolean;
  buildCache?: boolean;
}
