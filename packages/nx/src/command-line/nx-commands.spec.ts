import { commandsObject } from './nx-commands';
import { reportCommandRunEvent } from '../analytics';

import yargsParser from 'yargs-parser';

vi.mock('../analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../analytics')>()),
  reportCommandRunEvent: vi.fn(),
}));
vi.mock('../utils/handle-import', () => ({
  handleImport: async () => ({ runOne: async () => 0 }),
}));

describe('nx-commands', () => {
  describe('analytics command name', () => {
    beforeEach(() => {
      vi.mocked(reportCommandRunEvent).mockClear();
      vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      [['run', 'shop:deploy', '--token=secret']],
      [['deploy', 'shop', '--token=secret']],
      [['deploy', '--token=secret']],
      [['deploy', 'shop']],
      [['test', 'shop', 'apps/shop/src/customer.spec.ts']],
      [['--token=secret', 'deploy', 'shop']],
    ])('should report %j as run', async (argv) => {
      await commandsObject.parseAsync(argv);

      expect(reportCommandRunEvent).toHaveBeenCalledTimes(1);
      expect(reportCommandRunEvent).toHaveBeenCalledWith(
        'run',
        undefined,
        expect.anything()
      );
    });
  });

  it('should parse dot notion cli args', () => {
    const actual = yargsParser(
      [
        'nx',
        'e2e',
        'project-e2e',
        '--env.NX_API_URL=http://localhost:4200',
        '--abc.123.xyx=false',
        '--a.b=3',
      ],
      commandsObject.parserConfiguration
    );

    expect(actual).toEqual(
      expect.objectContaining({
        abc: {
          '123': {
            xyx: 'false',
          },
        },
        a: {
          b: 3,
        },
        env: {
          NX_API_URL: 'http://localhost:4200',
        },
      })
    );
  });
});
