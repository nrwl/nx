import { render, configure, getDefaultNormalizer } from 'cli-testing-library';
import { resolve, join } from 'path';

describe('create-nx-workspace', () => {
  it('should show options on --help', async () => {
    configure({ renderAwaitTime: 2000 });
    const { getByText, debug, queryByText } = await render(
      'npx',
      ['ts-node', resolve(__dirname, './create-nx-workspace.ts'), '--help'],
      {
        cwd: join(__dirname, '../../..'),
      }
    );

    const expectText = (text) =>
      expect(
        queryByText(text, {
          normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
        })
      );

    debug();

    // Should show Usage command
    expect(
      getByText(
        'Usage: create-nx-workspace <name> [options] [new workspace options]'
      )
    ).toBeInTheConsole();

    // Should show options
    expectText(/name.*Workspace name/).toBeInTheConsole();
    expectText(
      /preset.*Customizes the initial content of your workspace/
    ).toBeInTheConsole();
    expectText(
      /appName.*The name of the application created by some presets/
    ).toBeInTheConsole();
    expectText(/cli.*CLI to power the Nx workspace/).toBeInTheConsole();
    expectText(
      /style.*Default style option to be used when a non-empty preset is selected/
    ).toBeInTheConsole();
    expectText(
      /interactive.*Enable interactive mode when using presets/
    ).toBeInTheConsole();
    expectText(/packageManager.*Package manager to use/).toBeInTheConsole();
    expectText(/defaultBase.*Name of the main branch/).toBeInTheConsole();
    expectText(/nx-cloud.*Use Nx Cloud/).toBeInTheConsole();

    // Should show presets
    expectText(
      /preset.*"apps", "core", "ts", "web-components", "angular", "angular-nest", "react", "react-express", "react-native", "next", "nest", "express"/
    ).toBeInTheConsole();
    // Should not show deprecated presets
    expectText(/preset.*"empty"/).not.toBeInTheConsole();
    expectText(/preset.*"npm"/).not.toBeInTheConsole();
    // Should show supported CLIs
    expectText(/cli.*"nx", "angular"/).toBeInTheConsole();
    // Should show supported package managers
    expectText(/packageManager.*\n.*"npm", "yarn", "pnpm"/).toBeInTheConsole();
  });
});
