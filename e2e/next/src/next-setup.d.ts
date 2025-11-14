export interface NextTestSetup {
  proj: string;
  originalEnv: string;
}
export declare function setupNextTest(): NextTestSetup;
export declare function resetNextEnv(setup: NextTestSetup): void;
export declare function cleanupNextTest(): void;
//# sourceMappingURL=next-setup.d.ts.map
