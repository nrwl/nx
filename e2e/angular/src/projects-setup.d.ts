export interface ProjectsTestSetup {
  proj: string;
  app1: string;
  esbuildApp: string;
  lib1: string;
  app1DefaultModule: string;
  app1DefaultComponentTemplate: string;
  esbuildAppDefaultModule: string;
  esbuildAppDefaultComponentTemplate: string;
  esbuildAppDefaultProjectConfig: string;
}
export declare function setupProjectsTest(): ProjectsTestSetup;
export declare function resetProjectsTest(setup: ProjectsTestSetup): void;
export declare function cleanupProjectsTest(): void;
//# sourceMappingURL=projects-setup.d.ts.map
