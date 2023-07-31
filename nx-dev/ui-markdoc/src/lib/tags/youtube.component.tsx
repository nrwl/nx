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
      default: '50%',
    },
    caption: {
      // Added caption attribute here
      type: 'String',
      required: false, // Not required since it's optional
    },
  },
};

export function YouTube(props: any): JSX.Element {
  return (
    <div className="text-center">
      {' '}
      {/* Center alignment applied to the container */}
      <iframe
        {...props}
        title={props.title}
        width={props.width || '50%'}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        loading="lazy"
        className="rounded-lg shadow-lg mb-1"
      />
      {props.caption && (
        <p className="w-1/2 mx-auto pt-0 text-slate-500 dark:text-slate-400">
          {props.caption}
        </p>
      )}
    </div>
  );
}
