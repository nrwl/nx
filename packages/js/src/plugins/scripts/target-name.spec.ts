import { parseTargetName } from './target-name';

describe('parseTargetName', () => {
  it.each([
    ['#!/usr/bin/env node\n// @nx-target-name: serve\n', 'serve'],
    ['#!/usr/bin/env node\n//@nx-target-name:  seed-db  \n', 'seed-db'],
    [
      '#!/usr/bin/env node\n\n/* Copyright */\n// eslint-disable\n// @nx-target-name: dev\n',
      'dev',
    ],
    ['#!/usr/bin/env node\r\n// @nx-target-name: dev\r\n', 'dev'],
    ['#!/usr/bin/env node\n// @nx-target-name: db:seed\n', 'db:seed'],
    [
      '#!/usr/bin/env node\n/**\n * Dev server.\n * @nx-target-name: dev\n */\n',
      'dev',
    ],
    ['#!/usr/bin/env node\nimport x;\n// @nx-target-name: late\n', undefined],
    ['#!/usr/bin/env node\nconsole.log(1);\n', undefined],
  ])('%j -> %j', (header, expected) => {
    expect(parseTargetName(header)).toEqual({ name: expected, warnings: [] });
  });

  it.each([['// @nx-target-name:', '"@nx-target-name" is empty']])(
    'should reject %j',
    (directive, warning) => {
      expect(parseTargetName(`#!/usr/bin/env node\n${directive}\n`)).toEqual({
        name: undefined,
        warnings: [warning],
      });
    }
  );

  it('should keep the first directive and warn about the rest', () => {
    expect(
      parseTargetName(
        '#!/usr/bin/env node\n// @nx-target-name: a\n// @nx-target-name: b\n'
      )
    ).toEqual({
      name: 'a',
      warnings: ['ignoring the extra "@nx-target-name: b" directive'],
    });
  });
});
