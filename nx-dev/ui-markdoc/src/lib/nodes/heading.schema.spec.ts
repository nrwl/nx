import { generateID } from './heading.schema';

describe('heading schema: generateID', () => {
  it('should create ID with ony ASCII characters', () => {
    expect(generateID(['Hello', 'World'], {})).toEqual('hello-world');
    expect(generateID(['🎉 Pro: Simple Setup'], {})).toEqual(
      'pro-simple-setup'
    );
  });
});
