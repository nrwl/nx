import { RuleFailure } from 'tslint';
import * as ts from 'typescript';

import { Rule } from './nxEnforceModuleBoundariesRule';

describe('Enforce Module Boundaries', () => {
  it('should not error when everything is in order', () => {
    const failures = runRule(
      { allow: ['@mycompany/mylib/deep'] },
      `
      import '@mycompany/mylib';
      import '@mycompany/mylib/deep';
      import '../blah';
    `
    );

    expect(failures.length).toEqual(0);
  });

  it('should error on a relative import of a library', () => {
    const failures = runRule({}, `import '../../../libs/mylib';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('library imports must start with @mycompany/');
  });

  it('should error on absolute imports into libraries without using the npm scope', () => {
    const failures = runRule({}, `import 'libs/mylib';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('library imports must start with @mycompany/');
  });

  it('should error about deep imports into libraries', () => {
    const failures = runRule({}, `import '@mycompany/mylib/blah';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('deep imports into libraries are forbidden');
  });

  it('should not error about deep imports when libs contain the same prefix', () => {
    let failures = runRule(
      {},
      `import '@mycompany/reporting-dashboard-ui';
       import '@mycompany/reporting-other';
       import '@mycompany/reporting';
       `,
      ['reporting', 'reporting-dashboard-ui']
    );

    expect(failures.length).toEqual(0);

    // Make sure it works regardless of order of app names list
    failures = runRule(
      {},
      `import '@mycompany/reporting-dashboard-ui';
       import '@mycompany/reporting-other';
       import '@mycompany/reporting';`,
      ['reporting-dashboard-ui', 'reporting']
    );

    expect(failures.length).toEqual(0);
  });

  it('should error on importing a lazy-loaded library', () => {
    const failures = runRule({ lazyLoad: ['mylib'] }, `import '@mycompany/mylib';`);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('import of lazy-loaded libraries are forbidden');
  });
});

function runRule(ruleArguments: any, content: string, appNames: string[] = ['mylib']): RuleFailure[] {
  const options: any = {
    ruleArguments: [ruleArguments],
    ruleSeverity: 'error',
    ruleName: 'enforceModuleBoundaries'
  };

  const sourceFile = ts.createSourceFile('proj/apps/myapp/src/main.ts', content, ts.ScriptTarget.Latest, true);
  const rule = new Rule(options, 'proj', 'mycompany', appNames);
  return rule.apply(sourceFile);
}
