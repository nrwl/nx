/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';

export function getDisplayHeaderFromTargetConfiguration(
  targetConfiguration: TargetConfiguration
): {
  link: string | undefined;
  options: Record<string, any>;
  command?: string;
  commands?: string[];
  script?: string;
  executor?: string;
} {
  let link: string | undefined;
  let displayText: {
    command?: string;
    commands?: string[];
    script?: string;
    executor?: string;
  } = {
    executor: targetConfiguration.executor,
  };
  let options = targetConfiguration.options;
  // TODO: Handle this better because this will not work with labs
  if (targetConfiguration.executor?.startsWith('@nx/')) {
    const packageName = targetConfiguration.executor
      .split('/')[1]
      .split(':')[0];
    const executorName = targetConfiguration.executor
      .split('/')[1]
      .split(':')[1];
    link = `https://nx.dev/nx-api/${packageName}/executors/${executorName}`;
  } else if (targetConfiguration.executor === 'nx:run-commands') {
    link = `https://nx.dev/nx-api/nx/executors/run-commands`;
    displayText.command =
      targetConfiguration.command ?? targetConfiguration.options?.command;
    displayText.commands = targetConfiguration.options?.commands?.map(
      (c: { command: string }) => c.command ?? c
    );
    const { command, commands, ...rest } = targetConfiguration.options;
    options = rest;
  } else if (targetConfiguration.executor === 'nx:run-script') {
    link = `https://nx.dev/nx-api/nx/executors/run-script`;
    displayText.command = targetConfiguration.metadata?.runCommand;
    displayText.script = targetConfiguration.metadata?.scriptContent;
    const { script, ...rest } = targetConfiguration.options;
    options = rest;
  }

  return {
    ...displayText,
    link,
    options,
  };
}
