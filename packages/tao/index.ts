#!/usr/bin/env node
import './src/compat/angular-cli-compat';

export async function invokeCommand(
  command: string,
  root: string,
  commandArgs: string[]
) {
  if (command === undefined) {
    command = 'help';
  }
  switch (command) {
    case 'new':
      return (await import('./src/commands/generate')).taoNew(
        root,
        commandArgs
      );
    case 'generate':
    case 'g':
      return (await import('./src/commands/generate')).generate(
        root,
        commandArgs
      );
    case 'run':
    case 'r':
      return (await import('./src/commands/run')).run(root, commandArgs);
    case 'help':
    case '--help':
      return (await import('./src/commands/help')).printHelp();
    default:
      // this is to make `tao test mylib` same as `tao run mylib:test`
      return (await import('./src/commands/run')).run(root, [
        `${commandArgs[0]}:${command}`,
        ...commandArgs.slice(1)
      ]);
  }
}

export async function invokeCli(root: string, args: string[]) {
  const [command, ...commandArgs] = args;
  process.exit(await invokeCommand(command, root, commandArgs));
}

invokeCli(process.cwd(), process.argv.slice(2));
