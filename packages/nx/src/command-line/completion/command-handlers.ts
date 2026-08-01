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
 *
 * Yargs only keys handlers by canonical name. We mirror each alias to its
 * canonical handler reference so lookups like `handlers['g']` resolve to
 * the same entry as `handlers['generate']`.
 */
export function getNxCommandHandlers(): CommandHandlers {
  const { commandsObject } = require('../nx-commands') as {
    commandsObject: {
      getInternalMethods(): {
        getCommandInstance(): { getCommandHandlers(): CommandHandlers };
        getUsageInstance(): { getCommands(): unknown[][] };
      };
    };
  };
  const internal = commandsObject.getInternalMethods();
  const handlers = { ...internal.getCommandInstance().getCommandHandlers() };
  for (const row of internal.getUsageInstance().getCommands()) {
    // usage.getCommands() rows: [usagePattern, description, isDefault, aliases, deprecated]
    const usagePattern = String(row[0] ?? '');
    const aliases = Array.isArray(row[3]) ? (row[3] as string[]) : [];
    const canonical = usagePattern.split(/\s+/)[0];
    const handler = handlers[canonical];
    if (!handler) continue;
    for (const alias of aliases) {
      if (!handlers[alias]) handlers[alias] = handler;
    }
  }
  return handlers;
}

/** Subcommand name → description, visible-option name → description, and
 *  canonical option name → its yargs-declared aliases (e.g. projects → [p]). */
export interface BuilderIntrospection {
  subcommands: Map<string, string | undefined>;
  options: Map<string, string | undefined>;
  aliases: Map<string, string[]>;
}

/**
 * Run a yargs builder against a throwaway instance and return its declared
 * subcommands, visible options, and option-alias groups. Returns null if
 * the builder throws. Does NOT call `.argv` — would trigger parse and the
 * help-printing path we're avoiding.
 */
export function introspectBuilder(
  builder: (yargs: any) => any
): BuilderIntrospection | null {
  const yargs = require('yargs') as typeof import('yargs');
  const temp: any = (yargs as any)();
  try {
    builder(temp);
  } catch {
    return null;
  }

  const usage = temp.getInternalMethods().getUsageInstance();

  const subcommands = new Map<string, string | undefined>();
  for (const [usagePattern, desc] of usage.getCommands()) {
    const name = String(usagePattern).split(/\s+/)[0];
    if (name === '$0') continue;
    subcommands.set(name, desc as string | undefined);
  }

  const opts = temp.getOptions();
  const descriptions = usage.getDescriptions();
  const options = new Map<string, string | undefined>();
  for (const k of Object.keys(opts.key ?? {})) {
    if ((opts.hiddenOptions ?? []).includes(k)) continue;
    options.set(k, descriptions[k]);
  }

  const aliases = new Map<string, string[]>();
  for (const [canonical, list] of Object.entries(opts.alias ?? {})) {
    aliases.set(canonical, list as string[]);
  }

  return { subcommands, options, aliases };
}
