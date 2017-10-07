import { RuleFailure } from 'tslint';
import * as ts from 'typescript';

import { Rule } from './nxEnforceModuleBoundariesRule';

describe('Enforce Module Boundaries', () => {
  it('should not error when everything is in order', () => {
    const failures = runRule(
      { npmScope: 'mycompany' },
      `
      import '@mycompany/mylib';
      import '../blah';
    `
    );

    expect(failures.length).toEqual(0);
  });

  it('should error on a relative import of a library', () => {
    const failures = runRule({}, `import '../../../libs/mylib';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('relative imports of libraries are forbidden');
  });

  it('should error about deep imports into libraries', () => {
    const failures = runRule({ npmScope: 'mycompany' }, `import '@mycompany/mylib/blah';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('deep imports into libraries are forbidden');
  });

  it('should error on importing a lazy-loaded library', () => {
    const failures = runRule({ npmScope: 'mycompany', lazyLoad: ['mylib'] }, `import '@mycompany/mylib';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('import of lazy-loaded libraries are forbidden');
  });
});

function runRule(ruleArguments: any, content: string): RuleFailure[] {
  const options: any = {
    ruleArguments: [ruleArguments],
    ruleSeverity: 'error',
    ruleName: 'enforceModuleBoundaries'
  };

  const sourceFile = ts.createSourceFile('proj/apps/myapp/src/main.ts', content, ts.ScriptTarget.Latest, true);
  const rule = new Rule(options, 'proj');
  return rule.apply(sourceFile);
}
