import { findDisabledTests } from './index';

describe('no-disabled-tests', () => {
  const project = 'test-project';
  const file = 'packages/test-project/src/foo.spec.ts';

  describe('findDisabledTests()', () => {
    it('should return no violations for normal tests', () => {
      const content = `
describe('my feature', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });

  test('another test', () => {
    expect(1 + 1).toBe(2);
  });
});
`;
      expect(findDisabledTests(content, file, project)).toEqual([]);
    });

    it('should detect it.skip() and include the test description', () => {
      const content = `
describe('my feature', () => {
  it.skip('should handle edge case', () => {
    expect(true).toBe(true);
  });
});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"should handle edge case"');
      expect(violations[0].message).toContain('.skip()');
      expect(violations[0].message).toContain('line 3');
    });

    it('should detect test.skip()', () => {
      const content = `test.skip('network timeout handling', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"network timeout handling"');
    });

    it('should detect describe.skip()', () => {
      const content = `describe.skip('my suite', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"my suite"');
    });

    it('should detect xit()', () => {
      const content = `xit('should work', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"should work"');
      expect(violations[0].message).toContain('x-prefixed test');
    });

    it('should detect xdescribe()', () => {
      const content = `xdescribe('my suite', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"my suite"');
    });

    it('should detect xtest()', () => {
      const content = `xtest('should work', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"should work"');
    });

    it('should detect it.todo()', () => {
      const content = `it.todo('should implement this later');`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"should implement this later"');
      expect(violations[0].message).toContain('.todo()');
    });

    it('should detect test.todo()', () => {
      const content = `test.todo('should implement this later');`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('"should implement this later"');
    });

    it('should detect multiple violations in one file', () => {
      const content = `
describe('my feature', () => {
  it.skip('first skipped', () => {});
  xit('second skipped', () => {});
  test.todo('not yet implemented');
});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(3);
    });

    it('should include nearby TODO comments in the message', () => {
      const content = `
describe('my feature', () => {
  // TODO: re-enable once the API is stable
  it.skip('should call the API', () => {});
});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain(
        'TODO: re-enable once the API is stable'
      );
    });

    it('should include FIXME comments in the message', () => {
      const content = `
  // FIXME: flaky on CI
  test.skip('integration test', () => {});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('FIXME: flaky on CI');
    });

    it('should find TODO comments up to 3 lines above', () => {
      const content = `
  // TODO: blocked by upstream bug #1234
  //
  // some extra context
  it.skip('should work', () => {});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain(
        'TODO: blocked by upstream bug #1234'
      );
    });

    it('should not pick up TODO comments more than 3 lines above', () => {
      const content = `
  // TODO: too far away
  //
  //
  //
  it.skip('should work', () => {});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).not.toContain('too far away');
    });

    it('should flag disabled tests in comments since commented-out tests should be removed', () => {
      const content = `
// it.skip('this is a comment')
it('should handle skip text', () => {
  const msg = "it.skip is not allowed";
});
`;
      const violations = findDisabledTests(content, file, project);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('line 2');
    });

    it('should include correct file and project in violations', () => {
      const content = `it.skip('test', () => {});`;
      const violations = findDisabledTests(content, file, project);
      expect(violations[0]).toMatchObject({
        file: 'packages/test-project/src/foo.spec.ts',
        sourceProject: 'test-project',
      });
    });
  });
});
