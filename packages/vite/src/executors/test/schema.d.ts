export interface VitestExecutorSchema {
  config: string;
  passWithNoTests: boolean;
  testNamePattern?: string;
  mode: 'test' | 'benchmark' | 'typecheck';
  reporters?: string[];
  watch: boolean;
  update: boolean;
}
