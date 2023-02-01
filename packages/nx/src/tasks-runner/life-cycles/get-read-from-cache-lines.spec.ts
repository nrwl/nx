import { EOL } from 'os';

import { output } from '../../utils/output';
import { getReadFromCacheLines } from './get-read-from-cache-lines';

describe('getReadFromCacheLines', () => {
  it.each([
    ['no lines when nothing was cached', 0, 1, []],
    [
      'a happy line when 1 of 1 task was cached',
      1,
      1,
      [
        output.colors.cyan(
          `${EOL}  ✨⚡️ All 1 command built from cache! ⚡️✨`
        ),
      ],
    ],
    [
      'happy lines when 2 of 2 tasks were cached',
      2,
      2,
      [
        output.colors.cyan(
          `${EOL}  ✨⚡️ All 2 commands built from cache! ⚡️✨`
        ),
      ],
    ],
    [
      'dim lines when 2 of 2 tasks were cached',
      1,
      2,
      [
        output.dim(
          `${EOL}  Nx read the output from the cache instead of running the command for 1 out of 2 tasks.`
        ),
      ],
    ],
  ] as const)('returns %s', (_, totalCachedTasks, totalTasks, expected) => {
    const actual = getReadFromCacheLines(totalCachedTasks, totalTasks);

    expect(actual).toEqual(expected);
  });
});
