import { runCLI, readJson, uniq } from "@nx/e2e-utils";
import {
  setupRemixTsSolutionTest,
  cleanupRemixTsSolutionTest,
} from "./remix-ts-solution-setup";

describe("Remix - TS solution setup", () => {
  beforeEach(() => {
    setupRemixTsSolutionTest();
  });

  afterEach(() => {
    cleanupRemixTsSolutionTest();
  });

  it("should respect and support generating libraries with a name different than the import path", async () => {
    const lib = uniq("lib");

    runCLI(
      `generate @nx/remix:library packages/${lib} --name=${lib} --linter=eslint --unitTestRunner=vitest --buildable`
    );

    const packageJson = readJson(`packages/${lib}/package.json`);
    expect(packageJson.nx.name).toBe(lib);

    expect(runCLI(`build ${lib}`)).toContain(
      `Successfully ran target build for project ${lib}`
    );
    expect(runCLI(`typecheck ${lib}`)).toContain(
      `Successfully ran target typecheck for project ${lib}`
    );
    expect(runCLI(`lint ${lib}`)).toContain(
      `Successfully ran target lint for project ${lib}`
    );
    expect(runCLI(`test ${lib}`)).toContain(
      `Successfully ran target test for project ${lib}`
    );
  }, 120_000);
});
