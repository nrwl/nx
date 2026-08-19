import { isCI } from 'nx/src/devkit-internals';

/**
 * `@clack/prompts` is ESM-only; `module: nodenext` preserves this dynamic
 * import through CommonJS emit.
 *
 * Imported directly rather than through `nx/src/devkit-internals`: this file
 * ships to external plugins under devkit's +/- 1 major tolerance, so it cannot
 * rely on symbols added to a newer `nx` than the one installed.
 */
async function prompts() {
  return await import('@clack/prompts');
}

interface PromptChoice {
  value: string;
  label?: string;
  hint?: string;
}

/**
 * A single question. Mirrors the subset of the previous enquirer shape that
 * callers actually use, so existing generators keep working unchanged.
 *
 * @deprecated First-party plugins should prefer the per-kind helpers exported
 * from `@nx/devkit/internal`. Removed in Nx 25.
 */
export interface PromptQuestion {
  name: string;
  type:
    | 'input'
    | 'select'
    | 'autocomplete'
    | 'multiselect'
    | 'confirm'
    | 'numeral';
  message: string;
  choices?: (string | { name: string; message?: string; hint?: string })[];
  /**
   * A choice index for list prompts, otherwise the pre-filled answer. Both
   * forms were accepted before and callers rely on each.
   */
  initial?: number | boolean | string;
}

function toChoices(question: PromptQuestion): PromptChoice[] {
  return (question.choices ?? []).map((c) =>
    typeof c === 'string'
      ? { value: c }
      : { value: c.name, label: c.message, hint: c.hint }
  );
}

async function ask(question: PromptQuestion): Promise<unknown> {
  const { autocomplete, multiselect, text, isCancel } = await prompts();
  const unwrap = <T>(value: T | symbol): T => {
    // clack's cancel sentinel is a module-local symbol, so `isCancel` only
    // recognises a cancel from the same copy of `@clack/core`. A prompt
    // resolves to its value or that sentinel, so any symbol is a cancel.
    if (isCancel(value) || typeof value === 'symbol') {
      process.exit(130);
    }
    return value as T;
  };

  switch (question.type) {
    case 'confirm': {
      const answer = unwrap(
        await autocomplete({
          validate: (value) =>
            value === undefined ? 'Pick one of the listed options' : undefined,
          message: question.message,
          options: [{ value: 'Yes' }, { value: 'No' }],
          initialValue: question.initial === false ? 'No' : 'Yes',
        })
      );
      return answer === 'Yes';
    }
    case 'multiselect':
      return unwrap(
        await multiselect({
          message: question.message,
          options: toChoices(question),
          required: false,
        })
      );
    case 'select':
    case 'autocomplete': {
      const choices = toChoices(question);
      return unwrap(
        await autocomplete({
          validate: (value) =>
            value === undefined ? 'Pick one of the listed options' : undefined,
          message: question.message,
          options: choices,
          initialValue:
            typeof question.initial === 'number'
              ? choices[question.initial]?.value
              : choices[0]?.value,
        })
      );
    }
    case 'numeral': {
      // No numeric prompt; the answer is parsed back so callers still get a
      // number rather than the typed string.
      const answer = unwrap(
        await text({
          message: question.message,
          initialValue:
            question.initial === undefined
              ? undefined
              : String(question.initial),
          validate: (value) =>
            value !== '' && !Number.isNaN(Number(value))
              ? undefined
              : 'Please enter a number',
        })
      );
      return Number(answer);
    }
    default:
      return unwrap(
        await text({
          message: question.message,
          initialValue:
            typeof question.initial === 'string' ? question.initial : undefined,
        })
      );
  }
}

export async function promptWhenInteractive<T>(
  questions: PromptQuestion | PromptQuestion[],
  defaultValue: T
): Promise<T> {
  if (!isInteractive()) {
    return defaultValue;
  }

  // Answers are keyed by question name, as the previous enquirer-backed
  // signature returned them.
  const answers: Record<string, unknown> = {};
  for (const question of Array.isArray(questions) ? questions : [questions]) {
    answers[question.name] = await ask(question);
  }
  return answers as T;
}

function isInteractive(): boolean {
  return (
    !isCI() && !!process.stdout.isTTY && process.env.NX_INTERACTIVE === 'true'
  );
}
