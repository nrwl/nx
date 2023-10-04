// options from https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/prebuild/index.ts
export interface ExpoPrebuildOptions {
  clean?: boolean; // default is false
  install: boolean; // default is true
  platform: 'all' | 'android' | 'ios'; // default is all
  template?: string;
}
