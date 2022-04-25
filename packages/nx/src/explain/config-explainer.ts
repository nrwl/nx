type Markdown = string;

/**
 * A ConfigExplainer should be an object which has the same keys as the generic `Config` which it
 * is explaining, but importantly, regardless of the optionality of the keys of the underlying
 * `Config`, all keys are required to be implemented (we use the TS built in `Required<T>` to
 * enforce that).
 *
 * The value of each entry in the ConfigExplainer instance should be an object containing a
 * markdown `description` and an `explainConfig()` method which will be given the user's actual
 * config to interpret at runtime.
 */
export type ConfigExplainer<Config> = Required<{
  [key in keyof Config]: {
    description: Markdown;
    explainConfig: (configValue: Config[key]) => Markdown;
  };
}>;
