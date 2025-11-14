export interface DotNetProjectOptions {
  name: string;
  type: 'console' | 'classlib' | 'xunit' | 'webapi';
  cwd?: string;
}
export declare function createDotNetProject({
  name,
  type,
  cwd,
}: DotNetProjectOptions): string;
export declare function createDotNetSolution(
  solutionName: string,
  projects: DotNetProjectOptions[],
  cwd?: string
): {
  solutionPath: string;
  projectPaths: string[];
};
export declare function addProjectReference(
  fromProject: string,
  toProject: string,
  cwd?: string
): void;
export declare function addPackageReference(
  project: string,
  packageName: string,
  version: string | null,
  cwd: string
): void;
export declare function createSimpleDotNetWorkspace(cwd?: string): {
  solutionPath: string;
  projectPaths: string[];
};
export declare function createWebApiWorkspace(cwd?: string): {
  solutionPath: string;
  projectPaths: string[];
};
export declare function updateProjectFile(
  projectName: string,
  updates: (content: string) => string,
  cwd?: string
): void;
export declare function enableArtifactsOutput(
  artifactsPath?: string,
  cwd?: string
): void;
export declare function setCustomPivot(
  projectName: string,
  pivot: string,
  cwd?: string
): void;
export declare function enableMultiTargeting(
  projectName: string,
  targetFrameworks: string[],
  cwd?: string
): void;
export declare function setCustomOutputPath(
  projectName: string,
  outputPath: string,
  intermediatePath?: string,
  cwd?: string
): void;
//# sourceMappingURL=create-dotnet-project.d.ts.map
