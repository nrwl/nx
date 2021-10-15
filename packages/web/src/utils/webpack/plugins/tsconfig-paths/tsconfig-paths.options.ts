export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface Options {
  readonly configFile: string;
  readonly extensions: ReadonlyArray<string>;
  readonly baseUrl: string | undefined;
  readonly silent: boolean;
  readonly logLevel: LogLevel;
  readonly logInfoToStdOut: boolean;
  readonly context: string | undefined;
  readonly colors: boolean;
  readonly mainFields: string[];
}

type ValidOptions = keyof Options;
const validOptions: ReadonlyArray<ValidOptions> = [
  'configFile',
  'extensions',
  'baseUrl',
  'silent',
  'logLevel',
  'logInfoToStdOut',
  'context',
  'mainFields',
];

/**
 * Takes raw options from the webpack config,
 * validates them and adds defaults for missing options
 */
export function getOptions(rawOptions: {}): Options {
  validateOptions(rawOptions);

  const options = makeOptions(rawOptions);

  return options;
}

/**
 * Validate the supplied loader options.
 * At present this validates the option names only; in future we may look at validating the values too
 * @param rawOptions
 */
function validateOptions(rawOptions: {}): void {
  const loaderOptionKeys = Object.keys(rawOptions);
  for (let i = 0; i < loaderOptionKeys.length; i++) {
    const option = loaderOptionKeys[i];
    const isUnexpectedOption =
      (validOptions as ReadonlyArray<string>).indexOf(option) === -1;
    if (isUnexpectedOption) {
      throw new Error(`tsconfig-paths-webpack-plugin was supplied with an unexpected loader option: ${option}
Please take a look at the options you are supplying; the following are valid options:
${validOptions.join(' / ')}
`);
    }
  }
}

function makeOptions(rawOptions: Partial<Options>): Options {
  const options: Options = {
    ...({
      configFile: 'tsconfig.json',
      extensions: ['.ts', '.tsx'],
      baseUrl: undefined,
      silent: false,
      logLevel: 'WARN',
      logInfoToStdOut: false,
      context: undefined,
      colors: true,
      mainFields: ['main'],
    } as Options),
    ...rawOptions,
  };

  const options2: Options = {
    ...options,
    logLevel: options.logLevel.toUpperCase() as LogLevel,
  };

  return options2;
}
