import { output } from '../../utils/output';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils';

describe('formatFlags', () => {
  it('should properly show string values', () => {
    expect(formatFlags('', 'myflag', 'myvalue')).toBe('  --myflag=myvalue');
  });
  it('should properly show number values', () => {
    expect(formatFlags('', 'myflag', 123)).toBe('  --myflag=123');
  });
  it('should properly show boolean values', () => {
    expect(formatFlags('', 'myflag', true)).toBe('  --myflag=true');
  });
  it('should properly show array values', () => {
    expect(formatFlags('', 'myflag', [1, 23, 'abc'])).toBe(
      '  --myflag=[1,23,abc]'
    );
  });
  it('should properly show object values', () => {
    expect(formatFlags('', 'myflag', { abc: 'def', ghi: { jkl: 42 } })).toBe(
      '  --myflag={"abc":"def","ghi":{"jkl":42}}'
    );
  });
  it('should not break on invalid inputs', () => {
    expect(formatFlags('', 'myflag', (abc) => abc)).toBe(
      '  --myflag=(abc) => abc'
    );
    expect(formatFlags('', 'myflag', NaN)).toBe('  --myflag=NaN');
  });
  it('should decompose positional values', () => {
    expect(formatFlags('', '_', ['foo', 'bar', 42, 'baz'])).toBe(
      '  foo bar 42 baz'
    );
  });
  it('should handle indentation', () => {
    expect(formatFlags('_____', 'myflag', 'myvalue')).toBe(
      '_____  --myflag=myvalue'
    );
  });
  it('should handle indentation with positionals', () => {
    expect(formatFlags('_____', '_', ['foo', 'bar', 42, 'baz'])).toBe(
      '_____  foo bar 42 baz'
    );
  });
});

describe('formatTargetsAndProjects', () => {
  it('should handle single project and target', () => {
    expect(
      formatTargetsAndProjects(
        ['myproject'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:build',
            target: {
              project: 'myproject',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('build')} for project myproject`);

    expect(
      formatTargetsAndProjects(
        ['myproject'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('lint')} for project myproject`);
  });

  it('should handle single project and multiple targets', () => {
    expect(
      formatTargetsAndProjects(
        ['myproject'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:build',
            target: {
              project: 'myproject',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject:test',
            target: {
              project: 'myproject',
              target: 'test',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(
      `targets ${output.bold('build')}, ${output.bold(
        'test'
      )} for project myproject`
    );
    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('lint')} for project myproject`);

    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject2:lint',
            target: {
              project: 'myproject2',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('lint')} for project myproject2`);
  });

  it('should handle multiple projects and targets', () => {
    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:build',
            target: {
              project: 'myproject',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject2:build',
            target: {
              project: 'myproject2',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('build')} for 2 projects`);

    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject2:lint',
            target: {
              project: 'myproject2',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(`target ${output.bold('lint')} for 2 projects`);

    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject2:build',
            target: {
              project: 'myproject2',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(
      `targets ${output.bold('lint')}, ${output.bold('build')} for 2 projects`
    );
  });

  it('should handle dependent tasks', () => {
    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:build',
            target: {
              project: 'myproject',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject3:build',
            target: {
              project: 'myproject3',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(
      `target ${output.bold('build')} for project myproject and ${output.bold(
        1
      )} task it depends on`
    );

    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject2:lint',
            target: {
              project: 'myproject2',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject3:lint',
            target: {
              project: 'myproject3',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(
      `target ${output.bold('lint')} for 2 projects and ${output.bold(
        1
      )} task they depend on`
    );

    expect(
      formatTargetsAndProjects(
        ['myproject', 'myproject2'],
        ['lint', 'build', 'test'],
        [
          {
            id: 'myproject:lint',
            target: {
              project: 'myproject',
              target: 'lint',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject2:build',
            target: {
              project: 'myproject2',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject3:build',
            target: {
              project: 'myproject3',
              target: 'build',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
          {
            id: 'myproject3:bundle',
            target: {
              project: 'myproject3',
              target: 'bundle',
            },
            overrides: {},
            parallelism: false,
            outputs: [],
          },
        ]
      )
    ).toEqual(
      `targets ${output.bold('lint')}, ${output.bold(
        'build'
      )} for 2 projects and ${output.bold(2)} tasks they depend on`
    );
  });
});
