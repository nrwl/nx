import yargs from 'yargs';
import { yargsReleaseCommand } from './command-object';

const { releaseCLIHandler } = vi.hoisted(() => ({
  releaseCLIHandler: vi.fn(async () => {
    throw new Error('release handler reached');
  }),
}));

vi.mock('../../utils/handle-import', () => ({
  handleImport: async (path: string) => {
    if (path === '../../config/nx-json.js') {
      return { readNxJson: () => ({}) };
    }
    if (path === './release.js') {
      return { releaseCLIHandler };
    }
    throw new Error(`Unexpected import: ${path}`);
  },
}));

describe('release command options', () => {
  it('passes the distribution tag to the combined release handler', async () => {
    await expect(
      yargs([])
        .command(yargsReleaseCommand)
        .exitProcess(false)
        .parseAsync(['release', '--tag=next', '--skip-publish'])
    ).rejects.toThrow('release handler reached');

    expect(releaseCLIHandler).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'next' })
    );
  });
});
