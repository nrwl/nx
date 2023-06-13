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
    title: {
      type: 'String',
      required: false,
      description:
        'Title of the repository, otherwise it will default to "Example repository"',
    },
  },
};
