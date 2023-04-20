export const ASYNC_GENERATOR_EXECUTOR_CONTENTS = `import { ExecutorContext } from '@nrwl/devkit';

async function* asyncGenerator(
) {
  for (let i = 5; i < 10; i++) {
    yield new Promise((res) => setTimeout(() => res({ success: true }), 5));
  }
  yield { success: true };
}

export default async function* execute(
  options: unknown,
  context: ExecutorContext
) {
  for (let i = 5; i < 10; i++) {
    yield new Promise((res) => setTimeout(() => res({ success: true }), 5));
  }
  yield* asyncGenerator();
}
`;
