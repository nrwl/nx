import { runCLI, checkFilesExist, readJson, uniq } from "@nx/e2e-utils";
import {
  setupNxRemixTestYarn,
  cleanupNxRemixTest,
} from "./nx-remix-setup-yarn";

describe("Remix E2E Tests", () => {
  describe("--integrated (yarn)", () => {
    beforeAll(async () => {
      setupNxRemixTestYarn();
    });

    afterAll(() => {
      cleanupNxRemixTest();
    });

    it("should create app", async () => {
      const plugin = uniq("remix");
      runCLI(
        `generate @nx/remix:app ${plugin} --linter=eslint --unitTestRunner=vitest`
      );

      const buildResult = runCLI(`build ${plugin}`);
      expect(buildResult).toContain("Successfully ran target build");

      const testResult = runCLI(`test ${plugin}`);
      expect(testResult).toContain("Successfully ran target test");
    }, 120000);

    describe("--directory", () => {
      it("should create src in the specified directory", async () => {
        const plugin = uniq("remix");
        runCLI(
          `generate @nx/remix:app --name=${plugin} --directory=subdir --rootProject=false --no-interactive --linter=eslint --unitTestRunner=vitest`
        );

        const result = runCLI(`build ${plugin}`);
        expect(result).toContain("Successfully ran target build");
        checkFilesExist(`subdir/build/server/index.js`);
      }, 120000);
    });

    describe("--tags", () => {
      it("should add tags to the project", async () => {
        const plugin = uniq("remix");
        runCLI(
          `generate @nx/remix:app apps/${plugin} --tags e2etag,e2ePackage --linter=eslint --unitTestRunner=vitest`
        );
        const project = readJson(`apps/${plugin}/project.json`);
        expect(project.tags).toEqual(["e2etag", "e2ePackage"]);
      }, 120000);
    });

    describe("--js", () => {
      it("should create js app and build correctly", async () => {
        const plugin = uniq("remix");
        runCLI(
          `generate @nx/remix:app ${plugin} --js=true --linter=eslint --unitTestRunner=vitest`
        );

        const result = runCLI(`build ${plugin}`);
        expect(result).toContain("Successfully ran target build");
      }, 120000);
    });
  });
});
