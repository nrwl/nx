import { generateID } from './heading.schema';

describe('heading schema: generateID', () => {
  it('should create ID with ony ASCII characters', () => {
    expect(generateID(['Hello', 'World'], {})).toEqual('hello-world');
    expect(generateID(['🎉 Pro: Simple Setup'], {})).toEqual(
      'pro-simple-setup'
    );
  });

  it('should create id for code based headers', () => {
    const codeHeader = [
      {
        $$mdtype: 'Tag',
        name: 'code',
        attributes: {},
        children: ['launch-templates.<template-name>.init-steps[*].env'],
      },
    ];

    expect(generateID(codeHeader, {})).toEqual(
      'launchtemplatestemplatenameinitstepsenv'
    );
  });
});
