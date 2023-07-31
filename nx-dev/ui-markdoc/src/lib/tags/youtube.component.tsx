import { Schema } from '@markdoc/markdoc';

export const youtube: Schema = {
  render: 'YouTube',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    title: {
      type: 'String',
      required: true,
    },
    width: {
      type: 'String',
      default: '100%',
    },
    caption: {
      // Added caption attribute here
      type: 'String',
      required: false, // Not required since it's optional
    },
  },
};

export function YouTube(props: {
  title: string;
  caption: string;
  src: string;
  width: string;
}): JSX.Element {
  return (
    <div className="text-center">
      {' '}
      {/* Center alignment applied to the container */}
      <iframe
        src={props.src}
        title={props.title}
        width={props.width || '100%'}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        loading="lazy"
        className="rounded-lg shadow-lg mb-1"
      />
      {props.caption && (
        <p className="md:w-1/2 mx-auto pt-0 text-slate-500 dark:text-slate-400">
          {props.caption}
        </p>
      )}
    </div>
  );
}
