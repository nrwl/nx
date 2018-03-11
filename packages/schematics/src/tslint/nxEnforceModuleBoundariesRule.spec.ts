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

  it('should not error when lib name prefix collides with name of lazy loaded lib', () => {
    const failures = runRule({ lazyLoad: ['mylib'] }, `import '@mycompany/mylib-not-lazy';`);
    expect(failures.length).toEqual(0);
  });

  describe('relative imports', () => {
    it('should not error when relatively importing the same library', () => {
      const failures = runRuleToCheckForRelativeImport('import "../mylib2"');
      expect(failures.length).toEqual(0);
    });

    it('should not error when relatively importing the same library (index file)', () => {
      const failures = runRuleToCheckForRelativeImport('import "../../mylib"');
      expect(failures.length).toEqual(0);
    });

    it('should not error when relatively importing the same library (lib name prefix collision)', () => {
      const failures = runRuleToCheckForRelativeImport(
        'import "../some-comp"',
        '/proj/libs/dir/mylib2/src/module.t'
      );
      expect(failures.length).toEqual(0);
    });

    it('should error when relatively importing another library', () => {
      const failures = runRuleToCheckForRelativeImport('import "../../../libs/mylib2"');
      expect(failures.length).toEqual(1);
      expect(failures[0].getFailure()).toEqual('library imports must start with @mycompany/');
    });

    it('should error on a relatively importing another library (in the same dir)', () => {
      const failures = runRuleToCheckForRelativeImport('import "../../mylib2"');
      expect(failures.length).toEqual(1);
      expect(failures[0].getFailure()).toEqual('library imports must start with @mycompany/');
    });
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
    expect(failures[0].getFailure()).toEqual('imports of lazy-loaded libraries are forbidden');
  });

  it('should error on importing an app', () => {
    const failures = runRule({ lazyLoad: ['mylib'] }, `import '@mycompany/myapp';`, [], ['myapp']);

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual('imports of apps are forbidden');
  });

  it('should error on importing a lib that has the same prefix as an app', () => {
    const noFailures = runRule({ lazyLoad: [] }, `import '@mycompany/myapp/mylib';`, ['myapp/mylib'], ['myapp']);

    expect(noFailures.length).toEqual(0);
  });
});

function runRule(
  ruleArguments: any,
  content: string,
  libNames: string[] = ['mylib'],
  appNames: string[] = []
): RuleFailure[] {
  const options: any = {
    ruleArguments: [ruleArguments],
    ruleSeverity: 'error',
    ruleName: 'enforceModuleBoundaries'
  };
  const roots = [...appNames.map(a => `apps/${a}`), ...libNames.map(l => `libs/${l}`)];

  const sourceFile = ts.createSourceFile(
    '/proj/apps/myapp/src/main.ts',
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const rule = new Rule(options, '/proj', 'mycompany', libNames, appNames, roots);
  return rule.apply(sourceFile);
}

function runRuleToCheckForRelativeImport(
  content: string,
  sourceFilePath = '/proj/libs/dir/mylib/src/module.t'
): RuleFailure[] {
  const options: any = {
    ruleArguments: [{}],
    ruleSeverity: 'error',
    ruleName: 'enforceModuleBoundaries'
  };

  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const rule = new Rule(
    options,
    '/proj',
    'mycompany',
    ['dir/mylib', 'dir/mylib2'],
    [],
    ['libs/dir/mylib', 'libs/dir/mylib2']
  );
  return rule.apply(sourceFile);
}
