// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/start/resolveOptions.ts

export interface ExpoStartOptions {
  forceManifestType: 'classic' | 'expo-updates';
  privateKeyPath?: string;
  port: number;
  dev?: boolean;
  devClient?: boolean;
  minify?: boolean;
  https?: boolean;
  clear?: boolean;
  maxWorkers?: number;
  scheme?: string;
  ios?: boolean;
  android?: boolean;
  web?: boolean;
  host?: 'localhost' | 'lan' | 'tunnel';
  lan?: boolean;
  localhost?: boolean;
  tunnel?: boolean;
  offline?: boolean;
  /**
   * @deprecated
   */
  sendTo?: string; // deprecated from @expo/cli
  /**
   * @deprecated
   */
  webpack?: boolean; // deprecated from @expo/cli
}
