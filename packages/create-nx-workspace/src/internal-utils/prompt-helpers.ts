import { CnwError } from '../utils/error-utils';

/**
 * `@clack/prompts` is ESM-only. A static import would compile to `require()`
 * under CommonJS emit and throw ERR_REQUIRE_ESM; `module: nodenext` preserves
 * this dynamic form.
 */
async function prompts() {
  return await import('@clack/prompts');
}

export interface Choice<T extends string> {
  value: T;
  label?: string;
  hint?: string;
}

/** A bare string is a choice whose label is its value. */
export type ChoiceOrValue<T extends string> = T | Choice<T>;

function toChoice<T extends string>(choice: ChoiceOrValue<T>): Choice<T> {
  return typeof choice === 'string' ? { value: choice } : choice;
}

interface SelectPromptOptions<T extends string> {
  message: string;
  choices: readonly ChoiceOrValue<T>[];
  /**
   * Answer without prompting. The value is the first choice unless
   * `skippedValue` says otherwise.
   */
  skip?: boolean;
  skippedValue?: T;
  /** Highlighted when the prompt opens. Has no bearing on `skip`. */
  initial?: T;
}

export async function selectPrompt<T extends string>(
  options: SelectPromptOptions<T>
): Promise<T> {
  if (options.skip) {
    return options.skippedValue ?? toChoice(options.choices[0]).value;
  }
  const choices = options.choices.map(toChoice);
  const { autocomplete, isCancel } = await prompts();
  const answer = await autocomplete<T>({
    message: options.message,
    // `Option<Value>` is conditional on `Value extends Primitive`, which
    // TypeScript cannot resolve while `T` is still generic.
    options: choices.map((c) => ({
      value: c.value,
      label: c.label ?? c.value,
      ...(c.hint ? { hint: c.hint } : {}),
    })) as Parameters<typeof autocomplete<T>>[0]['options'],
    initialValue: options.initial ?? choices[0].value,
    // A no-match filter leaves clack with an empty selection, and Enter then
    // submits `undefined` rather than blocking. `isCancel` does not catch
    // that, so downstream comparisons would silently take a wrong branch.
    validate: (value) =>
      value === undefined ? 'Pick one of the listed options' : undefined,
  });
  // Ctrl+C yields a sentinel rather than throwing.
  if (isCancel(answer)) {
    throw new CnwError('CANCELLED', 'Cancelled.');
  }
  return answer as T;
}

export async function confirmationPrompt(options: {
  message: string;
  skip?: boolean;
  /** Answer used when skipped. Defaults to yes, matching a first-choice skip. */
  skippedValue?: boolean;
  initial?: boolean;
}): Promise<boolean> {
  const answer = await selectPrompt<'Yes' | 'No'>({
    message: options.message,
    choices: [{ value: 'Yes' }, { value: 'No' }],
    skip: options.skip,
    skippedValue:
      options.skippedValue === undefined
        ? undefined
        : options.skippedValue
          ? 'Yes'
          : 'No',
    initial: options.initial === false ? 'No' : 'Yes',
  });
  return answer === 'Yes';
}

export async function textPrompt(options: {
  message: string;
  initialValue?: string;
  /** Runs synchronously; clack does not await validators. */
  validate?: (value: string) => string | undefined;
  skip?: boolean;
  skippedValue?: string;
}): Promise<string> {
  if (options.skip) {
    return options.skippedValue ?? options.initialValue ?? '';
  }
  const { text, isCancel } = await prompts();
  const answer = await text({
    message: options.message,
    initialValue: options.initialValue,
    validate: options.validate,
  });
  if (isCancel(answer)) {
    throw new CnwError('CANCELLED', 'Cancelled.');
  }
  return answer as string;
}
