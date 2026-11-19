import { logger } from 'nx/src/devkit-exports';
import {
  readConfigFiles,
  resolveConfigFileTarget,
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

describe('resolveConfigFileTarget', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('prefers the entry and warns once when the option differs', () => {
    const resolve = () =>
      resolveConfigFileTarget('tool', 'tool.config.ts', 'target', 'test', {
        name: 'targetName',
        value: 'unit',
      });

    expect(resolve()).toBe('test');
    expect(resolve()).toBe('test');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'tool: configFiles sets the "tool.config.ts" target to "test", overriding targetName "unit".'
    );
  });

  it('names the ci target in the warning', () => {
    expect(
      resolveConfigFileTarget('tool', 'tool.config.ts', 'ci', 'test-ci', {
        name: 'ciTargetName',
        value: 'ci',
      })
    ).toBe('test-ci');
    expect(warn).toHaveBeenCalledWith(
      'tool: configFiles sets the "tool.config.ts" ci target to "test-ci", overriding ciTargetName "ci".'
    );
  });

  it('does not warn when the option matches or is unset', () => {
    expect(
      resolveConfigFileTarget('tool', 'tool.config.ts', 'target', 'same', {
        name: 'targetName',
        value: 'same',
      })
    ).toBe('same');
    expect(
      resolveConfigFileTarget('tool', 'tool.config.ts', 'target', 'unset', {
        name: 'targetName',
        value: undefined,
      })
    ).toBe('unset');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the option without an entry value', () => {
    expect(
      resolveConfigFileTarget('tool', 'tool.config.ts', 'ci', undefined, {
        name: 'ciTargetName',
        value: 'test-ci',
      })
    ).toBe('test-ci');
    expect(warn).not.toHaveBeenCalled();
  });
});
