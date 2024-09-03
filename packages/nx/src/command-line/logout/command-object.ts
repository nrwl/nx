import { CommandModule } from 'yargs';
import { withVerbose } from '../../command-line/yargs-utils/shared-options';

export const yargsLogoutCommand: CommandModule = {
  command: 'logout',
  describe: false,
  builder: (yargs) => withVerbose(yargs),
  handler: async (args: any) => {
    process.exit(await (await import('./logout')).logoutHandler(args));
  },
};
