import { prompt } from 'enquirer';
import { isCI } from 'nx/src/devkit-internals';

export async function promptWhenInteractive<T>(
  questions: Parameters<typeof prompt>[0],
  defaultValue: T
): Promise<T> {
  if (!isInteractive()) {
    return defaultValue;
  }

  return await prompt(questions);
}

function isInteractive(): boolean {
  return (
    !isCI() && !!process.stdout.isTTY && process.env.NX_INTERACTIVE === 'true'
  );
}
