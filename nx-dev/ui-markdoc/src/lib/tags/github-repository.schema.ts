import { Schema } from '@markdoc/markdoc';

export const githubRepository: Schema = {
  render: 'GithubRepository',
  description: 'Display the provided repository link into a clickable button.',
  attributes: {
    url: {
      type: 'String',
      required: true,
      description: 'The url of the GitHub repository',
    },
  },
};
