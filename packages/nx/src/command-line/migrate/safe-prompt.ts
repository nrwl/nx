import { exitAsInterrupted } from '../../utils/exit-codes';
import { isCI } from '../../utils/is-ci';
import { output } from '../../utils/output';
import {
  selectPrompt,
  Choice,
  confirmationPrompt,
} from '../../utils/prompt-helpers';

/**
 * Whether `nx migrate` may show interactive prompts: requires a TTY on stdin,
 * not running in CI, and the user not having passed `--no-interactive`.
 */
export function canPrompt(interactive: boolean | undefined): boolean {
  return !!process.stdin.isTTY && !isCI() && interactive !== false;
}

/**
 * Aborts the run the way `nx migrate` wants a cancel to look: one notice, then
 * POSIX 130 (128 + SIGINT). The user asked to stop, so there is no state worth
 * preserving.
 */
function cancelMigrate(): never {
  process.stdout.write('\n');
  output.warn({ title: 'nx migrate interrupted by user.' });
  exitAsInterrupted();
}

/**
 * Yes/no question for `nx migrate`, aborting the run if the user cancels.
 */
export async function migrateConfirm(options: {
  message: string;
  initial?: boolean;
}): Promise<boolean> {
  return confirmationPrompt({
    message: options.message,
    initial: options.initial,
    onCancel: cancelMigrate,
  });
}

/**
 * Single-choice question for `nx migrate`, aborting the run if the user cancels.
 */
export async function migrateChoice<T extends string>(options: {
  message: string;
  choices: Choice<T>[];
  initial?: T;
}): Promise<T> {
  return selectPrompt<T>({
    message: options.message,
    choices: options.choices,
    initial: options.initial,
    onCancel: cancelMigrate,
  });
}
