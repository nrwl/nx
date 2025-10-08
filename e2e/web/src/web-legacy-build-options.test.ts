import {
  createFile,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from "@nx/e2e-utils";
import { join } from "path";

describe("Build Options (legacy) ", () => {
  it("should inject/bundle external scripts and styles", async () => {
    newProject();

    const appName = uniq("app");

    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: "false",
        },
      }
    );

    const srcPath = `apps/${appName}/src`;
    const fooCss = `${srcPath}/foo.css`;
    const barCss = `${srcPath}/bar.css`;
    const fooJs = `${srcPath}/foo.js`;
    const barJs = `${srcPath}/bar.js`;
    const fooCssContent = `/* ${uniq("foo")} */`;
    const barCssContent = `/* ${uniq("bar")} */`;
    const fooJsContent = `/* ${uniq("foo")} */`;
    const barJsContent = `/* ${uniq("bar")} */`;

    createFile(fooCss);
    createFile(barCss);
    createFile(fooJs);
    createFile(barJs);

    // createFile could not create a file with content
    updateFile(fooCss, fooCssContent);
    updateFile(barCss, barCssContent);
    updateFile(fooJs, fooJsContent);
    updateFile(barJs, barJsContent);

    const barScriptsBundleName = "bar-scripts";
    const barStylesBundleName = "bar-styles";

    updateJson(join("apps", appName, "project.json"), (config) => {
      const buildOptions = config.targets.build.options;

      buildOptions.scripts = [
        {
          input: fooJs,
          inject: true,
        },
        {
          input: barJs,
          inject: false,
          bundleName: barScriptsBundleName,
        },
      ];

      buildOptions.styles = [
        {
          input: fooCss,
          inject: true,
        },
        {
          input: barCss,
          inject: false,
          bundleName: barStylesBundleName,
        },
      ];
      return config;
    });

    runCLI(`build ${appName} --optimization=false --outputHashing=none`);

    const distPath = `dist/apps/${appName}`;
    const scripts = readFile(`${distPath}/scripts.js`);
    const styles = readFile(`${distPath}/styles.css`);
    const barScripts = readFile(`${distPath}/${barScriptsBundleName}.js`);
    const barStyles = readFile(`${distPath}/${barStylesBundleName}.css`);

    expect(scripts).toContain(fooJsContent);
    expect(scripts).not.toContain(barJsContent);
    expect(barScripts).toContain(barJsContent);

    expect(styles).toContain(fooCssContent);
    expect(styles).not.toContain(barCssContent);
    expect(barStyles).toContain(barCssContent);
  });
});
