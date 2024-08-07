import { generateVersionPlanContent } from './generate-version-plan-content';

describe('generateVersionPlanContent()', () => {
  it('should generate the version plan content', () => {
    expect(generateVersionPlanContent({ proj: '1.0.0' }, 'message'))
      .toMatchInlineSnapshot(`
      "---
      proj: 1.0.0
      ---

      message
      "
    `);
  });

  it('should wrap project keys in quotes if they start with an @ symbol', () => {
    expect(
      generateVersionPlanContent(
        { '@proj/foo': '1.0.0', 'a-b-c': '2.3.4' },
        'message'
      )
    ).toMatchInlineSnapshot(`
      "---
      '@proj/foo': 1.0.0
      a-b-c: 2.3.4
      ---

      message
      "
    `);
  });

  it('should work without a message', () => {
    expect(generateVersionPlanContent({ proj: '1.0.0' }, ''))
      .toMatchInlineSnapshot(`
      "---
      proj: 1.0.0
      ---
      "
    `);
  });

  it('should work with multi-line messages', () => {
    expect(generateVersionPlanContent({ proj: '1.0.0' }, 'foo\nbar\nbaz'))
      .toMatchInlineSnapshot(`
      "---
      proj: 1.0.0
      ---

      foo
      bar
      baz
      "
    `);
  });
});
