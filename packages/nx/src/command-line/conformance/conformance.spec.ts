vi.mock('../../config/nx-json', () => ({ readNxJson: vi.fn(() => ({})) }));
vi.mock('../../utils/nx-cloud-utils', () => ({ isNxCloudUsed: vi.fn() }));
vi.mock('../nx-cloud/utils', () => ({ executeNxCloudCommand: vi.fn() }));

import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { executeNxCloudCommand } from '../nx-cloud/utils';
import { conformanceHandler } from './conformance';

describe('conformanceHandler', () => {
  const args = { _: [], $0: 'nx', verbose: true };

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it.each(['conformance', 'conformance:check'] as const)(
    'should run %s through the Nx Cloud client when connected',
    async (command) => {
      vi.mocked(isNxCloudUsed).mockReturnValue(true);
      vi.mocked(executeNxCloudCommand).mockResolvedValue(1);
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });
      const localHandler = vi.fn();

      await expect(
        conformanceHandler(command, args, localHandler)
      ).rejects.toThrow('process.exit');

      expect(executeNxCloudCommand).toHaveBeenCalledWith(command, true);
      expect(exit).toHaveBeenCalledWith(1);
      expect(localHandler).not.toHaveBeenCalled();
    }
  );

  it('should run the local handler when not connected to Nx Cloud', async () => {
    vi.mocked(isNxCloudUsed).mockReturnValue(false);
    const localHandler = vi.fn();

    await conformanceHandler('conformance', args, localHandler);

    expect(localHandler).toHaveBeenCalledWith(args);
    expect(executeNxCloudCommand).not.toHaveBeenCalled();
  });
});
