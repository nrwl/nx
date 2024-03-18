import { selectPrintAffected } from './print-affected';

describe('print-affected', () => {
  describe('selectPrintAffected', () => {
    const res = {
      projects: ['one', 'two'],
      tasks: [
        {
          target: {
            project: 'one',
          },
        },
        {
          target: {
            project: 'two',
          },
        },
      ],
    };

    it('should return the result if select is empty', () => {
      expect(selectPrintAffected(res, null)).toEqual(res);
    });

    it('should select an array if without nesting', () => {
      expect(selectPrintAffected(res, 'projects')).toEqual('one, two');
    });

    it('should throw when invalid key', () => {
      expect(() => selectPrintAffected(res, 'projects.invalid')).toThrowError(
        `Cannot select 'projects.invalid' in the results of print-affected.`
      );
    });

    it('should select an array if with nesting', () => {
      expect(selectPrintAffected(res, 'tasks.target.project')).toEqual(
        'one, two'
      );
    });
  });
});
