// options from https://docs.expo.dev/workflow/expo-cli/#expo-runios and https://docs.expo.dev/workflow/expo-cli/#expo-runandroid
export interface ExpoRunOptions {
  platform: 'ios' | 'android';
  xcodeConfiguration: string; // iOS only, default is Debug
  scheme?: string; // iOS only
  variant: string; // android only, default is debug
  port: number; // default is 8081
  bundler: boolean; // default is true
  sync: boolean; // default is true
  device?: string;
}
