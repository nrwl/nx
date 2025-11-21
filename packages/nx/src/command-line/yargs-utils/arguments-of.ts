import type { Argv, CommandModule as YargsCommandModule } from 'yargs';

export type Builder<InitialArgs, FinalArgs> = (
  yargs: Argv<InitialArgs>
) => Argv<FinalArgs>;

export type Handler<B extends Builder<any, any>> = (
  args: Awaited<ReturnType<B>['argv']>
) => void | Promise<void>;

export interface CommandModule<T, U>
  extends Omit<YargsCommandModule<T, U>, 'handler'> {
  builder: Builder<T, U>;
  handler: Handler<Builder<T, U>>;
}

/**
 * Helper function to define a Yargs CommandModule with proper typing and not sacrifice inference.
 */
export function makeCommandModule<T, U>(
  module: CommandModule<T, U>
): CommandModule<T, U> {
  return module;
}
