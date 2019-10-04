export interface Schema {
    project: string;
    mutator: string;
    packageManager: string;
    testRunner: string;
    coverageAnalysis: boolean;
    tsconfigFile: string;
    reporters: string[];
  }