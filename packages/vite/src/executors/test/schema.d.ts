export interface VitestExecutorOptions {
  config?: string;
  passWithNoTests?: boolean;
  testNamePattern?: string;
  mode?: 'test' | 'benchmark' | 'typecheck';
  reporters?: string[];
  watch?: boolean;
  update?: boolean;
  reportsDirectory?: string;
  coverage?: boolean;
  testFiles?: string[];
}
