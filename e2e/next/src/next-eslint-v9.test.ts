import {
  cleanupProject,
  newProject,
  packageInstall,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

describe('Next.js linting on ESLint v9', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/next', '@nx/react', '@nx/eslint', '@nx/js'] });
    packageInstall('eslint', null, '^9.8.0');
  });

  afterAll(() => cleanupProject());

  // eslint-config-next registers its own copies of the React plugins that
  // `flat/react` registers on ESLint v9, and ESLint rejects two copies of one plugin.
  it('should lint a Next.js 16 app when the root config spreads flat/react', () => {
    const reactLib = uniq('reactlib');
    const appName = uniq('app');

    // Writes the root config and installs the React plugins `flat/react` loads.
    runCLI(
      `generate @nx/react:lib ${reactLib} --linter=eslint --unitTestRunner=none --bundler=none --no-interactive`
    );
    updateFile('eslint.config.mjs', (content) =>
      content.replace(
        `...nx.configs['flat/base'],`,
        `...nx.configs['flat/base'],\n  ...nx.configs['flat/react'],`
      )
    );
    expect(readFile('eslint.config.mjs')).toContain(
      `...nx.configs['flat/react'],`
    );

    runCLI(
      `generate @nx/next:app ${appName} --appDir=true --e2eTestRunner=none --unitTestRunner=none --linter=eslint --no-interactive`
    );
    updateFile(
      `${appName}/src/app/page.tsx`,
      `export default function Page() {
  return <img src="/logo.png" alt="Logo" />;
}
`
    );

    const output = runCLI(`lint ${appName}`);
    expect(output).toContain('@next/next/no-img-element');
  }, 300_000);
});
