import React from 'react';

/* eslint-disable-next-line */
export interface ContentProps {
  data: any;
}

export function Content(props: ContentProps) {
  return (
    <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-10 pb-24 lg:pb-16">
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: props.data }}
      />
    </div>
  );
}

export default Content;
