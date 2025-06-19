import React from 'react';
import { title } from 'process';

export default function Video({ src, title }: { src: string; title?: string }) {
  return (
    <div className="text-center">
      <iframe
        src={src}
        title={title}
        width="100%"
        allow="autoplay; encrypted-media"
        className="rounded-lg shadow-lg"
        loading="lazy"
        credentialless="true"
      />
    </div>
  );
}
