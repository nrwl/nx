import Script from 'next/script';
import { Schema } from '@markdoc/markdoc';

export const tweet: Schema = {
  render: 'Tweet',
  attributes: {
    url: {
      type: 'String',
      required: true,
    },
  },
};

export function Tweet(props: { url: string }) {
  return (
    <>
      <blockquote
        className="twitter-tweet border-0"
        data-conversation="none"
        data-theme="light"
        data-lang="en"
        data-dnt="true"
      >
        <a href={props.url}>Loading tweet...</a>
      </blockquote>
      <Script
        async
        src="https://platform.twitter.com/widgets.js"
        charSet="utf-8"
      />
    </>
  );
}
