import { names } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  removeFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Vite Plugin', () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    proj = newProject({
      packages: ['@nx/react', '@nx/web'],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe('incremental building', () => {
    const app = uniq('demo');
    const lib = uniq('my-lib');
    beforeAll(() => {
      proj = newProject({
        name: uniq('vite-incr-build'),
        packages: ['@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${app} --bundler=vite --unitTestRunner=vitest --no-interactive  --directory=${app}`
      );

      // only this project will be directly used from dist
      runCLI(
        `generate @nx/react:lib ${lib}-buildable --unitTestRunner=none --bundler=vite --importPath="@acme/buildable" --no-interactive --directory=${lib}-buildable`
      );

      runCLI(
        `generate @nx/react:lib ${lib} --unitTestRunner=none --bundler=none --importPath="@acme/non-buildable" --no-interactive --directory=${lib}`
      );

      // because the default js lib builds as cjs it cannot be loaded from dist
      // so the paths plugin should always resolve to the libs source
      runCLI(
        `generate @nx/js:lib ${lib}-js --bundler=tsc --importPath="@acme/js-lib" --no-interactive  --directory=${lib}-js`
      );
      const buildableLibCmp = names(`${lib}-buildable`).className;
      const nonBuildableLibCmp = names(lib).className;
      const buildableJsLibFn = names(`${lib}-js`).propertyName;

      updateFile(`${app}/src/app/app.tsx`, () => {
        return `
import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import { ${buildableLibCmp} } from '@acme/buildable';
import { ${buildableJsLibFn} } from '@acme/js-lib';
import { ${nonBuildableLibCmp} } from '@acme/non-buildable';

export function App() {
  return (
     <div>
       <${buildableLibCmp} />
       <${nonBuildableLibCmp} />
       <p>{${buildableJsLibFn}()}</p>
       <NxWelcome title='${app}' />
      </div>
  );
}
export default App;
`;
      });
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should build app from libs source', () => {
      const results = runCLI(`build ${app} --buildLibsFromSource=true`);
      expect(results).toContain('Successfully ran target build for project');
      // this should be more modules than build from dist
      expect(results).toContain('38 modules transformed');
    });

    it('should build app from libs dist', () => {
      const results = runCLI(`build ${app} --buildLibsFromSource=false`);
      expect(results).toContain('Successfully ran target build for project');
      // this should be less modules than building from source
      expect(results).toContain('36 modules transformed');
    });

    it('should build app from libs without package.json in lib', () => {
      removeFile(`${lib}-buildable/package.json`);

      const buildFromSourceResults = runCLI(
        `build ${app} --buildLibsFromSource=true`
      );
      expect(buildFromSourceResults).toContain(
        'Successfully ran target build for project'
      );

      const noBuildFromSourceResults = runCLI(
        `build ${app} --buildLibsFromSource=false`
      );
      expect(noBuildFromSourceResults).toContain(
        'Successfully ran target build for project'
      );
    });
  });
});
