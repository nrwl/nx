import { EOL } from 'os';

async function wait() {
  return new Promise<void>((res) => {
    setTimeout(() => res(), 1000);
  });
}

interface CounterOptions {
  to: number;
  result: boolean;
}

export default async function* counter(opts: CounterOptions) {
  for (let i = 0; i < opts.to; ++i) {
    console.log(i);
    yield { success: false };
    await wait();
  }
  yield { success: opts.result };
}

export async function batchCounter(
  taskGraph,
  inputs: Record<string, CounterOptions>
) {
  const result: Record<string, { success: boolean; terminalOutput: string }> =
    {};

  const results = await Promise.all(
    (taskGraph.roots as string[])
      .map((rootTaskId) => [rootTaskId, inputs[rootTaskId]] as const)
      .map(async ([taskId, options]) => {
        let terminalOutput = '';
        for (let i = 0; i < options.to; ++i) {
          console.log(i);
          terminalOutput += i + EOL;
          await wait();
        }

        return [taskId, options.result, terminalOutput] as const;
      })
  );

  for (const [taskId, taskResult, terminalOutput] of results) {
    result[taskId] = {
      success: taskResult,
      terminalOutput,
    };
  }

  return result;
}
