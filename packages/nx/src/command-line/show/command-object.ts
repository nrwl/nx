import { Argv, CommandModule } from 'yargs';

const validObjectTypes = ['projects'] as const;
type NxObject = typeof validObjectTypes[number];

interface ShowCommandArguments {
  object: NxObject;
}

export const yargsShowCommand: CommandModule<
  ShowCommandArguments,
  ShowCommandArguments
> = {
  command: 'show <object>',
  describe: 'Show information about the workspace (e.g., list of projects)',
  builder: (yargs) => withShowOptions(yargs),
  handler: async (args) => {
    if (!validObjectTypes.includes(args.object)) {
    }
    await import('./show').then((m) => m.show(args));
    process.exit(0);
  },
};

function withShowOptions(yargs: Argv) {
  return yargs
    .positional('object', {
      describe: 'What to show (e.g., projects)',
      choices: ['projects'],
      required: true,
    })
    .coerce({
      object: (arg) => {
        if (validObjectTypes.includes(arg)) {
          return arg;
        } else {
          throw new Error(
            `Invalid object type: ${arg}. Valid object types are: ${validObjectTypes.join(
              ', '
            )}`
          );
        }
      },
    });
}
