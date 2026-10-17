// Forked by evaluateUnderTaskEnv. It imports nothing at runtime so the
// evaluated module starts in a process as clean as the task's.
import type { TaskEnvEvaluationMessage } from './evaluate-under-task-env';

const [modulePath, exportName, args] = process.argv.splice(2);

// As in plugin workers: config helpers skip what needs the project graph,
// which is still being created
global.NX_GRAPH_CREATION = true;

// The parent's timeout cannot kill this process once the parent is gone
process.on('disconnect', () => process.exit(1));

// process.exit can drop an IPC message that has not been flushed yet
function send(message: TaskEnvEvaluationMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    process.send(message, (error: Error | null) =>
      error ? reject(error) : resolve()
    );
  });
}

async function evaluate(): Promise<void> {
  const result = await require(modulePath)[exportName](...JSON.parse(args));
  await send({ type: 'nx-task-env-evaluation-result', result });
}

// Exit explicitly: the evaluated module can leave handles open
evaluate().then(
  () => process.exit(0),
  async (error) => {
    try {
      await send({
        type: 'nx-task-env-evaluation-error',
        error: error?.stack || error?.message || String(error),
      });
    } catch {
      // The exit code still reports the failure
    }
    process.exit(1);
  }
);
