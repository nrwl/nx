import {
  AggregateCreateNodesError,
  formatAggregateCreateNodesError,
} from './error-types';

describe('formatAggregateCreateNodesError', () => {
  it('should format a single error for a single file', () => {
    const error = new AggregateCreateNodesError(
      [['libs/mylib/project.json', new Error('Invalid configuration')]],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/jest');

    expect(error.message).toMatchInlineSnapshot(`
      "An error occurred while processing files for the @nx/jest plugin.
        - libs/mylib/project.json:
            Invalid configuration"
    `);
  });

  it('should group multiple errors for the same file under one header', () => {
    const error = new AggregateCreateNodesError(
      [
        ['libs/mylib/project.json', new Error('Missing name field')],
        ['libs/mylib/project.json', new Error('Invalid target configuration')],
      ],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/jest');

    expect(error.message).toMatchInlineSnapshot(`
      "2 errors occurred while processing files for the @nx/jest plugin.
        - libs/mylib/project.json:
            Missing name field
            Invalid target configuration"
    `);
  });

  it('should handle errors across multiple files', () => {
    const error = new AggregateCreateNodesError(
      [
        ['libs/a/project.json', new Error('Error in A')],
        ['libs/b/project.json', new Error('Error in B')],
        ['libs/a/project.json', new Error('Another error in A')],
      ],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/webpack');

    expect(error.message).toMatchInlineSnapshot(`
      "3 errors occurred while processing files for the @nx/webpack plugin.
        - libs/a/project.json:
            Error in A
            Another error in A
        - libs/b/project.json:
            Error in B"
    `);
  });

  it('should handle errors without a file', () => {
    const error = new AggregateCreateNodesError(
      [[null, new Error('General plugin error')]],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/react');

    expect(error.message).toMatchInlineSnapshot(`
      "An error occurred while processing files for the @nx/react plugin.
        - General plugin error"
    `);
  });

  it('should handle a mix of errors with and without files', () => {
    const error = new AggregateCreateNodesError(
      [
        ['libs/mylib/project.json', new Error('File-specific error')],
        [null, new Error('General error')],
      ],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/vite');

    expect(error.message).toMatchInlineSnapshot(`
      "2 errors occurred while processing files for the @nx/vite plugin.
        - libs/mylib/project.json:
            File-specific error
        - General error"
    `);
  });

  it('should indent multiline error messages under the file header', () => {
    const error = new AggregateCreateNodesError(
      [
        [
          'libs/mylib/project.json',
          new Error('Line one\nLine two\nLine three'),
        ],
      ],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/jest');

    expect(error.message).toMatchInlineSnapshot(`
      "An error occurred while processing files for the @nx/jest plugin.
        - libs/mylib/project.json:
            Line one
            Line two
            Line three"
    `);
  });

  it('should include plugin index when available', () => {
    const error = new AggregateCreateNodesError(
      [['libs/mylib/project.json', new Error('Config error')]],
      []
    );
    error.pluginIndex = 3;

    formatAggregateCreateNodesError(error, '@nx/jest');

    expect(error.message).toMatchInlineSnapshot(`
      "An error occurred while processing files for the @nx/jest plugin (Defined at nx.json#plugins[3]).
        - libs/mylib/project.json:
            Config error"
    `);
  });

  it('should format stack traces grouped by file', () => {
    const err = new Error('Something broke');
    err.stack = 'Error: Something broke\n    at foo (file.js:1:1)';
    const error = new AggregateCreateNodesError(
      [['libs/mylib/project.json', err]],
      []
    );

    formatAggregateCreateNodesError(error, '@nx/jest');

    expect(error.stack).toMatchInlineSnapshot(`
      " - libs/mylib/project.json:
           Error: Something broke
               at foo (file.js:1:1)"
    `);
  });
});
