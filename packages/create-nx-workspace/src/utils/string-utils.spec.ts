import { getFileName } from './string-utils';

describe('utils', () => {
  describe('getFileName', () => {
    it('should return nrwl-org given NrwlORG', () => {
      let name = 'NrwlORG';
      expect(getFileName(name)).toEqual('nrwl-org');
      expect(name).toEqual('NrwlORG');
    });
  });
});
