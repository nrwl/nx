/** A single entry from yargs' `getCommandHandlers()`. */
export interface CommandHandler {
  description?: string | false;
  builder?: (yargs: any) => any;
}

export type CommandHandlers = Record<string, CommandHandler>;

/**
 * Reach into the yargs commandsObject to enumerate registered command
 * handlers. Lazy-required: nx-commands pulls in the full command tree
 * and is only needed on the slow path.
 */
export function getNxCommandHandlers(): CommandHandlers {
  const { commandsObject } = require('../nx-commands') as {
    commandsObject: {
      getInternalMethods(): {
        getCommandInstance(): { getCommandHandlers(): CommandHandlers };
      };
    };
  };
  return commandsObject
    .getInternalMethods()
    .getCommandInstance()
    .getCommandHandlers();
}
