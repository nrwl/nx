import { logger } from 'nx/src/devkit-exports';
import {
  createConfigFileTargetResolver,
  readConfigFiles,
  type ConfigFileNamePatterns,
} from './config-files';

const patterns: ConfigFileNamePatterns = {
  defaultName: /^tool\.config\.ts$/,
  mappableName: /^tool\.config.*\.ts$/,
  mappableGlob: 'tool.config*.ts',
};

describe('readConfigFiles', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('reads a string as shorthand for an object with only a target', () => {
    expect(
      readConfigFiles(
        'tool',
        { 'tool.config.e2e.ts': 'e2e', 'tool.config.ts': 'test' },
        patterns
      )
    ).toEqual(
      new Map([
        ['tool.config.e2e.ts', { target: 'e2e' }],
        ['tool.config.ts', { target: 'test' }],
      ])
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads the object form with and without ci', () => {
    expect(
      readConfigFiles(
        'tool',
        {
          'tool.config.ts': { target: 'test', ci: 'test-ci' },
          'tool.config.e2e.ts': { target: 'e2e' },
        },
        patterns
      )
    ).toEqual(
      new Map([
        ['tool.config.ts', { target: 'test', ci: 'test-ci' }],
        ['tool.config.e2e.ts', { target: 'e2e' }],
      ])
    );
  });

  it.each([
    ['', 'its value must be a non-empty target name'],
    [42, 'its value must be a target name or an object with a "target" name'],
    [
      ['e2e'],
      'its value must be a target name or an object with a "target" name',
    ],
    [{ ci: 'e2e-ci' }, 'its "target" must be a non-empty target name'],
    [{ target: '' }, 'its "target" must be a non-empty target name'],
    [{ target: 'e2e', ci: '' }, 'its "ci" must be a non-empty target name'],
    [{ target: 'e2e', ci: 7 }, 'its "ci" must be a non-empty target name'],
    [
      { target: 'e2e', ci: 'e2e' },
      'its "ci" target must differ from its "target"',
    ],
  ])('drops the invalid value %j with a warning', (value, problem) => {
    const fileName = `tool.config.${JSON.stringify(value).replace(/\W/g, '')}.ts`;

    expect(readConfigFiles('tool', { [fileName]: value }, patterns)).toEqual(
      new Map()
    );
    expect(warn).toHaveBeenCalledWith(
      `tool: ignoring the "${fileName}" entry of configFiles because ${problem}.`
    );
  });

  it('drops a path key with a warning', () => {
    expect(
      readConfigFiles('tool', { 'e2e/tool.config.ts': 'e2e' }, patterns)
    ).toEqual(new Map());
    expect(warn).toHaveBeenCalledWith(
      'tool: ignoring the "e2e/tool.config.ts" entry of configFiles because keys are config file names in a project root, not paths.'
    );
  });

  it('drops a name the plugin glob does not match with a warning', () => {
    expect(
      readConfigFiles('tool', { 'tool.e2e.config.ts': 'e2e' }, patterns)
    ).toEqual(new Map());
    expect(warn).toHaveBeenCalledWith(
      'tool: ignoring the "tool.e2e.config.ts" entry of configFiles because the plugin only reads config files named tool.config*.ts.'
    );
  });

  it('prints each warning once per process', () => {
    const option = { 'tool.config.once.ts': '' };

    readConfigFiles('tool', option, patterns);
    readConfigFiles('tool', option, patterns);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('createConfigFileTargetResolver', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const createResolver = (
    configFiles: Record<string, unknown>,
    targetName?: string,
    ciTargetName?: string
  ) =>
    createConfigFileTargetResolver('tool', configFiles, patterns, {
      target: { name: 'targetName', value: targetName, default: 'test' },
      ci: { name: 'ciTargetName', value: ciTargetName },
    });

  it('gives a default config the top-level options', () => {
    expect(createResolver({}, 'unit', 'unit-ci')('tool.config.ts')).toEqual({
      isDefault: true,
      target: 'unit',
      ci: 'unit-ci',
    });
    expect(createResolver({})('tool.config.ts')).toEqual({
      isDefault: true,
      target: 'test',
      ci: undefined,
    });
  });

  it('gives a mapped config only its entry', () => {
    const resolve = createResolver(
      { 'tool.config.e2e.ts': { target: 'e2e', ci: 'e2e-ci' } },
      'unit',
      'unit-ci'
    );

    expect(resolve('tool.config.e2e.ts')).toEqual({
      isDefault: false,
      target: 'e2e',
      ci: 'e2e-ci',
    });
    expect(resolve('tool.config.other.ts')).toBeUndefined();
  });

  it('prefers the entry and warns once when the option differs', () => {
    const resolve = createResolver({ 'tool.config.ts': 'test' }, 'unit');

    expect(resolve('tool.config.ts').target).toBe('test');
    expect(resolve('tool.config.ts').target).toBe('test');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'tool: configFiles sets the "tool.config.ts" target to "test", overriding targetName "unit".'
    );
  });

  it('names the ci target in the warning', () => {
    expect(
      createResolver(
        { 'tool.config.ts': { target: 'test', ci: 'test-ci' } },
        undefined,
        'ci'
      )('tool.config.ts').ci
    ).toBe('test-ci');
    expect(warn).toHaveBeenCalledWith(
      'tool: configFiles sets the "tool.config.ts" ci target to "test-ci", overriding ciTargetName "ci".'
    );
  });

  it('does not warn when the option matches or is unset', () => {
    expect(
      createResolver({ 'tool.config.ts': 'same' }, 'same')('tool.config.ts')
        .target
    ).toBe('same');
    expect(
      createResolver({ 'tool.config.ts': 'unset' })('tool.config.ts').target
    ).toBe('unset');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the option without an entry value', () => {
    expect(
      createResolver(
        { 'tool.config.ts': 'test' },
        undefined,
        'test-ci'
      )('tool.config.ts').ci
    ).toBe('test-ci');
    expect(warn).not.toHaveBeenCalled();
  });
});
