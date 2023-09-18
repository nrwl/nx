import { createNxReleaseConfig } from './config';

describe('createNxReleaseConfig()', () => {
  const testCases = [
    {
      input: undefined,
      output: {
        groups: {},
      },
    },
    {
      input: {},
      output: {
        groups: {},
      },
    },
    {
      input: {
        groups: {},
      },
      output: {
        groups: {},
      },
    },
    {
      input: {
        groups: {
          foo: {
            projects: '*',
          },
        },
      },
      output: {
        groups: {
          foo: {
            projects: '*',
          },
        },
      },
    },
  ];

  testCases.forEach((c, i) => {
    it(`should create appropriate NxReleaseConfig, CASE: ${i}`, () => {
      expect(createNxReleaseConfig(c.input)).toEqual(c.output);
    });
  });
});
