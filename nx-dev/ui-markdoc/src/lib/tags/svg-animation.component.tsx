import { Schema } from '@markdoc/markdoc';
import { useEffect, useRef } from 'react';

export const svgAnimation: Schema = {
  render: 'SvgAnimation',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },

    title: {
      type: 'String',
      required: true,
    },
  },
};

export function SvgAnimation({
  src,
  title,
}: {
  src: string;
  title: string;
}): JSX.Element {
  const objectRef = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    if (objectRef.current) {
      fetch(src)
        .then((response) => response.text())
        .then((svgContent) => {
          objectRef.current!.data = `data:image/svg+xml,${encodeURIComponent(
            svgContent
          )}`;
        })
        .catch((error) => {
          console.error('Error fetching SVG:', error);
        });
    }
  }, [src]);

  return (
    <div className="w-full rounded-md border border-slate-100 bg-slate-50/20 p-4 dark:border-slate-800 dark:bg-slate-800/60">
      <object
        ref={objectRef}
        type="image/svg+xml"
        title={title}
        className="rounded-sm bg-white p-2 ring-1 ring-slate-50 dark:bg-slate-800/80 dark:ring-slate-800"
      >
        {title}
      </object>
    </div>
  );
}
