import { render } from 'cli-testing-library';
import { resolve } from 'path';

describe('create-nx-workspace', () => {
  it('should show options on --help', async () => {
    const { debug, instance } = await render(
      'yarn',
      ['ts-node', resolve(__dirname, './create-nx-workspace.ts'), '--help'],
      {
        cwd: resolve(__dirname, '../../../'),
      }
    );

    console.log(instance);

    debug();

    // expect(await findByText('Usage: create-nx-workspace <name> [options] [new workspace options]')).toBeInTheConsole;
    // expect(await findByText('Usage: create-nx-workspace <name> [options] [new workspace options]')).toEqual('test');
  });
});
