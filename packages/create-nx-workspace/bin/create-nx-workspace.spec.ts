import 'cli-testing-library/extend-expect';

import {
  render,
  configure,
  getDefaultNormalizer,
  fireEvent,
  TestInstance,
} from 'cli-testing-library';
import { resolve, join } from 'path';

describe('create-nx-workspace', () => {
  const cwd = join(__dirname, '../../..');
  const cnw_path = resolve(__dirname, './create-nx-workspace.ts');

  it('should show options on --help', async () => {
    configure({ renderAwaitTime: 3000 });
    const { queryByText, debug } = await render(
      'npx',
      ['ts-node', cnw_path, '--help'],
      { cwd }
    );

    const expectText = (text) =>
      expect(
        queryByText(text, {
          normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
        })
      );

    // Should show Usage command
    expectText(
      'Usage: create-nx-workspace <name> [options] [new workspace options]'
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

  it('should show workspace name if not provided', async () => {
    configure({ renderAwaitTime: 2000 });
    const { debug, findByText } = await render('npx', ['ts-node', cnw_path], {
      cwd,
    });

    const findTextInstance = async (text) =>
      (await findByText(text, {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      })) as Promise<TestInstance>;

    // Should show name prompt
    const instance = await findTextInstance('Workspace name (e.g., org name)');

    expect(instance).toBeInTheConsole();

    await fireEvent.sigterm(instance);
  });

  it('should not show workspace name if provided', async () => {
    configure({ renderAwaitTime: 2000 });
    const { findByText } = await render(
      'npx',
      ['ts-node', cnw_path, 'some-name'],
      { cwd }
    );

    const findTextInstance = async (text) =>
      (await findByText(text, {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      })) as Promise<TestInstance>;

    await expect(
      (async () =>
        expect(
          await findTextInstance('Workspace name (e.g., org name)')
        ).toBeInTheConsole())()
    ).rejects.toThrow();
  });
});
