import { classify, dasherize } from './strings';

describe('String utils', () => {
  describe('dasherize', () => {
    it('should format camel casing', () => {
      expect(dasherize('twoWords')).toEqual('two-words');
    });

    it('should camel casing with abbreviations', () => {
      expect(dasherize('twoWORDS')).toEqual('two-words');
    });

    it('should format spaces', () => {
      expect(dasherize('two words')).toEqual('two-words');
    });

    it('should format underscores', () => {
      expect(dasherize('two_words')).toEqual('two-words');
    });

    it('should format periods', () => {
      expect(dasherize('two.words')).toEqual('two-words');
    });

    it('should format dashes', () => {
      expect(dasherize('two-words')).toEqual('two-words');
    });

    it('should return single words', () => {
      expect(dasherize('word')).toEqual('word');
    });
  });

  describe('classify', () => {
    it('should format camel casing', () => {
      expect(classify('twoWords')).toEqual('TwoWords');
    });

    it('should camel casing with abbreviations', () => {
      expect(classify('twoWORDS')).toEqual('TwoWORDS');
    });

    it('should format spaces', () => {
      expect(classify('two words')).toEqual('TwoWords');
    });

    it('should format underscores', () => {
      expect(classify('two_words')).toEqual('TwoWords');
    });

    it('should format periods', () => {
      expect(classify('two.words')).toEqual('Two.Words');
    });

    it('should format dashes', () => {
      expect(classify('two-words')).toEqual('TwoWords');
    });

    it('should return single words', () => {
      expect(classify('word')).toEqual('Word');
    });
  });
});
