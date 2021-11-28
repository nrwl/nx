// options from https://docs.expo.dev/workflow/expo-cli/

export interface ExpoStartOptions {
  port: number;
  dev?: boolean;
  devClient?: boolean;
  minify?: boolean;
  https?: boolean;
  clear?: boolean;
  maxWorkers?: number;
  scheme?: string;
  sendTo?: string;
  ios?: boolean;
  android?: boolean;
  web?: boolean;
  host?: string;
  lan?: boolean;
  localhost?: boolean;
  tunnel?: boolean;
  offline?: boolean;
  webpack?: boolean;
}
