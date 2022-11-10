export interface VitestExecutorSchema {
  vitestConfig: string;
  passWithNoTests: boolean;
  testNamePattern?: string;
  vitestMode: 'test' | 'benchmark' | 'typecheck';
  reporters?: string[];
  watch: boolean;
}
