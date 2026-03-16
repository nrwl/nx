import { Schema } from '@markdoc/markdoc';
import { TweetEmbed } from './tweet-embed';

export const tweet: Schema = {
  render: 'Tweet',
  attributes: {
    url: {
      type: 'String',
      required: true,
    },
  },
};

export type TweetProps = { url: string };

export function Tweet(props: TweetProps) {
  return <TweetEmbed url={props.url} />;
}
