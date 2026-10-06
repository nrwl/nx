// Type-only, so it is erased at emit and never becomes a `require` of an
// ESM-only package. The runtime import stays dynamic below.
import type { Option } from '@clack/prompts';
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

/**
 * What a cancel resolves to. Defaults to aborting workspace creation; callers
 * pass one when cancelling means something the flow can carry on from.
 */
export type OnCancel<T> = () => T;

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
  onCancel?: OnCancel<T>;
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
    })) as Option<T>[],
    initialValue: options.initial ?? choices[0].value,
    // A no-match filter leaves clack with an empty selection, and Enter then
    // submits `undefined` rather than blocking. `isCancel` does not catch
    // that, so downstream comparisons would silently take a wrong branch.
    validate: (value) =>
      value === undefined ? 'Pick one of the listed options' : undefined,
  });
  // Ctrl+C yields a sentinel rather than throwing.
  if (isCancel(answer)) {
    if (options.onCancel) {
      return options.onCancel();
    }
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
  onCancel?: OnCancel<boolean>;
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
    onCancel: options.onCancel
      ? () => (options.onCancel!() ? 'Yes' : 'No')
      : undefined,
  });
  return answer === 'Yes';
}

export async function textPrompt(options: {
  message: string;
  initialValue?: string;
  /**
   * Runs synchronously; clack does not await validators.
   *
   * Always receives a string. clack validates on Enter *before* it coerces an
   * empty submit to `''`, so it would otherwise hand `undefined` to a prompt
   * declaring no `initialValue`; the wrapper below normalizes that, matching
   * what enquirer passed.
   */
  validate?: (value: string) => string | undefined;
  skip?: boolean;
  skippedValue?: string;
  onCancel?: OnCancel<string>;
}): Promise<string> {
  if (options.skip) {
    return options.skippedValue ?? options.initialValue ?? '';
  }
  const { text, isCancel } = await prompts();
  const answer = await text({
    message: options.message,
    initialValue: options.initialValue,
    validate: options.validate
      ? (value) => options.validate(value ?? '')
      : undefined,
  });
  if (isCancel(answer)) {
    if (options.onCancel) {
      return options.onCancel();
    }
    throw new CnwError('CANCELLED', 'Cancelled.');
  }
  return answer as string;
}

export async function multiselectPrompt<T extends string>(options: {
  message: string;
  choices: readonly ChoiceOrValue<T>[];
  required?: boolean;
  initialValues?: readonly T[];
}): Promise<T[]> {
  const choices = options.choices.map(toChoice);
  const { multiselect, isCancel } = await prompts();
  const answer = await multiselect<T>({
    message: options.message,
    options: choices.map((c) => ({
      value: c.value,
      label: c.label ?? c.value,
      ...(c.hint ? { hint: c.hint } : {}),
    })) as Option<T>[],
    required: options.required ?? false,
    initialValues: options.initialValues
      ? [...options.initialValues]
      : undefined,
  });
  if (isCancel(answer)) {
    throw new CnwError('CANCELLED', 'Cancelled.');
  }
  return answer as T[];
}
