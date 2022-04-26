type Markdown = string;

/**
 * A ConfigExplainer should be an object which has the same keys as the generic `Config` which it
 * is explaining, but importantly, regardless of the optionality of the keys of the underlying
 * `Config`, all keys are required to be implemented (we use the TS built in `Required<T>` to
 * enforce that).
 *
 * The value of each entry in the ConfigExplainer instance should be an object containing an
 * `nxDevLearnMorePath` which will be used to link out to the docs as the source of truth for
 * the generic field description and functionality, and an `explainConfig()` method which will be
 * given the user's actual config for that field in order to provide a specific explanation.
 */
export type ConfigExplainer<Config> = Required<{
  [key in keyof Config]: {
    /**
     * NOTE: We have configured e2e tests for nx-dev to ensure that all of the configurated `nxDevLearnMorePath`s
     * remain valid links over time.
     */
    nxDevLearnMorePath: `/${string}#${string}`;
    explainConfig: (configValue: Config[key]) => Markdown;
  };
}>;
