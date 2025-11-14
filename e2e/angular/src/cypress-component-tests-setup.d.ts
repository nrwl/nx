export interface CypressComponentTestsSetup {
  projectName: string;
  appName: string;
  usedInAppLibName: string;
  buildableLibName: string;
}
export declare function setupCypressComponentTests(): CypressComponentTestsSetup;
export declare function cleanupCypressComponentTests(): void;
export declare function updateTestToAssertTailwindIsNotApplied(
  libName: string
): void;
export declare function useBuildableLibInLib(
  projectName: string,
  buildableLibName: string,
  libName: string
): void;
export declare function updateBuilableLibTestsToAssertAppStyles(
  appName: string,
  buildableLibName: string
): void;
export declare function useRootLevelTailwindConfig(
  existingConfigPath: string
): void;
//# sourceMappingURL=cypress-component-tests-setup.d.ts.map
