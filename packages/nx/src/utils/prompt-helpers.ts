/**
 * `@clack/prompts` is ESM-only. A static import would compile to `require()`
 * under CommonJS emit and throw ERR_REQUIRE_ESM; `module: nodenext` preserves
 * this dynamic form.
 */
async function prompts() {
  return await import('@clack/prompts');
}

/**
 * clack's cancel sentinel is a module-local `Symbol('clack:cancel')`, so
 * `isCancel` only recognises a cancel from the same copy of `@clack/core`. Two
 * copies in one process (a version skew between `nx` and a plugin) would make
 * it silently return false and let the sentinel through as an answer. A prompt
 * only ever resolves to its value or that sentinel, so treating any symbol as
 * a cancel survives that.
 */
function cancelled(value: unknown, isCancel: (v: unknown) => boolean): boolean {
  return isCancel(value) || typeof value === 'symbol';
}

export interface Choice<T extends string> {
  value: T;
  label?: string;
  hint?: string;
}

/**
 * Ctrl+C yields a sentinel rather than throwing. `onCancel` decides what that
 * means for the caller - either a fallback answer or an abort. The default
 * aborts with the POSIX interrupt status.
 */
export type OnCancel<T> = () => T;

const defaultOnCancel = (): never => {
  process.exit(130);
};

export async function askChoice<T extends string>(options: {
  message: string;
  choices: Choice<T>[];
  initial?: T;
  /** Answer without prompting; defaults to the first choice. */
  skip?: boolean;
  skippedValue?: T;
  onCancel?: OnCancel<T>;
}): Promise<T> {
  if (options.skip) {
    return options.skippedValue ?? options.choices[0].value;
  }
  const { autocomplete, isCancel } = await prompts();
  const answer = await autocomplete<T>({
    message: options.message,
    // `Option<Value>` is conditional on `Value extends Primitive`, which
    // TypeScript cannot resolve while `T` is still generic.
    options: options.choices.map((c) => ({
      value: c.value,
      label: c.label ?? c.value,
      ...(c.hint ? { hint: c.hint } : {}),
    })) as Parameters<typeof autocomplete<T>>[0]['options'],
    initialValue: options.initial ?? options.choices[0].value,
    // A no-match filter leaves clack with an empty selection, and Enter then
    // submits `undefined` rather than blocking. `isCancel` does not catch
    // that, so downstream comparisons would silently take a wrong branch.
    validate: (value) =>
      value === undefined ? 'Pick one of the listed options' : undefined,
  });
  if (cancelled(answer, isCancel)) {
    return (options.onCancel ?? defaultOnCancel)();
  }
  return answer as T;
}

export async function askYesNo(options: {
  message: string;
  initial?: boolean;
  skip?: boolean;
  skippedValue?: boolean;
  onCancel?: OnCancel<boolean>;
}): Promise<boolean> {
  const answer = await askChoice<'Yes' | 'No'>({
    message: options.message,
    choices: [{ value: 'Yes' }, { value: 'No' }],
    initial: options.initial === false ? 'No' : 'Yes',
    skip: options.skip,
    skippedValue:
      options.skippedValue === undefined
        ? undefined
        : options.skippedValue
          ? 'Yes'
          : 'No',
    onCancel: options.onCancel
      ? () => (options.onCancel!() ? 'Yes' : 'No')
      : undefined,
  });
  return answer === 'Yes';
}

export async function askText(options: {
  message: string;
  initialValue?: string;
  placeholder?: string;
  /** Runs synchronously; clack does not await validators. */
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
    placeholder: options.placeholder,
    validate: options.validate,
  });
  if (cancelled(answer, isCancel)) {
    return (options.onCancel ?? defaultOnCancel)();
  }
  return answer as string;
}

export async function askMultiselect<T extends string>(options: {
  message: string;
  choices: Choice<T>[];
  required?: boolean;
  initialValues?: T[];
  onCancel?: OnCancel<T[]>;
}): Promise<T[]> {
  const { multiselect, isCancel } = await prompts();
  const answer = await multiselect<T>({
    message: options.message,
    options: options.choices.map((c) => ({
      value: c.value,
      label: c.label ?? c.value,
      ...(c.hint ? { hint: c.hint } : {}),
    })) as Parameters<typeof multiselect<T>>[0]['options'],
    required: options.required ?? false,
    initialValues: options.initialValues,
  });
  if (cancelled(answer, isCancel)) {
    return (options.onCancel ?? defaultOnCancel)();
  }
  return answer as T[];
}
