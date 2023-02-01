import { EOL } from 'os';

import { output } from '../../utils/output';

export function getReadFromCacheLines(
  totalCachedTasks: number,
  totalTasks: number
) {
  switch (totalCachedTasks) {
    case 0:
      return [];

    case totalTasks:
      return [
        output.colors.cyan(
          `${EOL}  ✨⚡️ All ${totalTasks} command${
            totalTasks === 1 ? '' : 's'
          } built from cache! ⚡️✨`
        ),
      ];

    default:
      return [
        output.dim(
          `${EOL}  Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
        ),
      ];
  }
}
