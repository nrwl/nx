import { applyChangesToString, ChangeType } from './string-change';

describe('applyChangesToString', () => {
  it('should insert text', () => {
    const original = 'Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Insert,
        index: 0,
        text: 'Start | ',
      },
      {
        type: ChangeType.Insert,
        index: 13,
        text: ' | End',
      },
    ]);

    expect(result).toEqual('Start | Original Text | End');
  });

  it('should sort addition changes', () => {
    const original = 'Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Insert,
        index: 13,
        text: ' | End',
      },
      {
        type: ChangeType.Insert,
        index: 0,
        text: 'Start | ',
      },
    ]);

    expect(result).toEqual('Start | Original Text | End');
  });

  it('should delete text', () => {
    const original = 'Start | Original Text | End';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
      {
        type: ChangeType.Delete,
        start: 21,
        length: 6,
      },
    ]);

    expect(result).toEqual('Original Text');
  });

  it('should sort deletion changes', () => {
    const original = 'Start | Original Text | End';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Delete,
        start: 21,
        length: 6,
      },
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
    ]);

    expect(result).toEqual('Original Text');
  });

  it('should handle both addition and deletion changes', () => {
    const original = 'Start | Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
      {
        type: ChangeType.Insert,
        index: 21,
        text: ' | End',
      },
    ]);

    expect(result).toEqual('Original Text | End');
  });

  it('should sort both addition and deletion changes', () => {
    const original = 'Start | Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Insert,
        index: 21,
        text: ' | End',
      },
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
    ]);

    expect(result).toEqual('Original Text | End');
  });

  it('should be able to replace text', () => {
    const original = 'Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Insert,
        index: 0,
        text: 'Updated',
      },
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
    ]);

    expect(result).toEqual('Updated Text');
  });

  it('should be able to replace text twice', () => {
    const original = 'Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
      {
        type: ChangeType.Insert,
        index: 0,
        text: 'Updated',
      },
      {
        type: ChangeType.Delete,
        start: 9,
        length: 4,
      },
      {
        type: ChangeType.Insert,
        index: 9,
        text: 'Updated',
      },
    ]);

    expect(result).toEqual('Updated Updated');
  });

  it('should sort changes when replacing text', () => {
    const original = 'Original Text';

    const result = applyChangesToString(original, [
      {
        type: ChangeType.Delete,
        start: 0,
        length: 8,
      },
      {
        type: ChangeType.Insert,
        index: 0,
        text: 'Updated',
      },
    ]);

    expect(result).toEqual('Updated Text');
  });

  it('should handle complex cases', () => {
    const code = `bootstrap({
  target: document.querySelector('#app')
})`;

    const indexOfPropertyName = 14; // Usually determined by analyzing an AST.
    const updatedCode = applyChangesToString(code, [
      {
        type: ChangeType.Insert,
        index: indexOfPropertyName,
        text: 'element',
      },
      {
        type: ChangeType.Delete,
        start: indexOfPropertyName,
        length: 6,
      },
    ]);

    expect(updatedCode).toMatchInlineSnapshot(`
      "bootstrap({
        element: document.querySelector('#app')
      })"
    `);
  });

  it('should throw an error if a number is not passed', () => {
    expect(() => {
      const original = 'Original Text';

      applyChangesToString(original, [
        {
          type: ChangeType.Insert,
          index: undefined,
          text: 'a',
        },
      ]);
    }).toThrowError();
  });

  it('should throw an error if a negative number is passed', () => {
    expect(() => {
      const original = 'Original Text';

      applyChangesToString(original, [
        {
          type: ChangeType.Insert,
          index: -2,
          text: 'a',
        },
      ]);
    }).toThrowError();
  });
});
