import runCommands, {
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';

(async function populateLocalRegistry() {
  const { success: localRegistrySuccess } = await runCommand({
    command: `pnpm exec nx local-registry`,
    readyWhen: 'http address -',
  });
  if (!localRegistrySuccess) {
    process.exit(1);
  }
  const { success } = await runCommand({
    command: `pnpm nx-release --local major`,
  });
  process.exit(success ? 0 : 1);
})();

async function runCommand(opts: Partial<RunCommandsOptions>) {
  return runCommands(
    {
      ...opts,
      __unparsed__: [],
    },
    {} as any
  );
}
