import {
  cleanupProject,
  createFile,
  newProject,
  readFile,
  readJson,
  rmDist,
  runCLI,
  uniq,
  listFiles,
  fileExists,
} from "@nx/e2e-utils";

describe("Vite Plugin", () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = "false";
    proj = newProject({
      packages: ["@nx/react", "@nx/web"],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe("Vite on Web apps", () => {
    describe("set up new @nx/web app with --bundler=vite option", () => {
      let myApp;
      beforeEach(() => {
        myApp = uniq("my-app");
        runCLI(
          `generate @nx/web:app ${myApp} --bundler=vite --unitTestRunner=vitest --directory=${myApp}`
        );
      });
      it("should build application", async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith(".js"));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();
        expect(fileExists(`dist/${myApp}/package.json`)).toBeFalsy();
        rmDist();
      }, 200_000);

      it("should build application with new package json generation", async () => {
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith(".js"));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        const packageJson = readJson(`dist/${myApp}/package.json`);
        expect(packageJson.name).toEqual(myApp);
        expect(packageJson.version).toEqual("0.0.1");
        expect(packageJson.type).toEqual("module");
        rmDist();
      }, 200_000);

      it("should build application with existing package json generation", async () => {
        createFile(
          `${myApp}/package.json`,
          JSON.stringify({
            name: "my-existing-app",
            version: "1.0.1",
            scripts: {
              start: "node server.js",
            },
          })
        );
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith(".js"));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        const packageJson = readJson(`dist/${myApp}/package.json`);
        expect(packageJson.name).toEqual("my-existing-app");
        expect(packageJson.version).toEqual("1.0.1");
        expect(packageJson.type).toEqual("module");
        expect(packageJson.scripts).toEqual({
          start: "node server.js",
        });
        rmDist();
      }, 200_000);

      it("should build application without copying exisiting package json when generatePackageJson=false", async () => {
        createFile(
          `${myApp}/package.json`,
          JSON.stringify({
            name: "my-existing-app",
            version: "1.0.1",
            scripts: {
              start: "node server.js",
            },
          })
        );
        runCLI(`build ${myApp} --generatePackageJson=false`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith(".js"));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        expect(fileExists(`dist/${myApp}/package.json`)).toBe(false);
        rmDist();
      }, 200_000);
    });

    100_000;
  });
});
