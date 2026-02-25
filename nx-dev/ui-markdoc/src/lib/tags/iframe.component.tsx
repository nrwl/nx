export type IframeProps = {
  src: string;
  title: string;
  width?: string;
};

export function Iframe(props: IframeProps) {
  return (
    <iframe
      {...props}
      title={props.title}
      frameBorder="0"
      className="not-content rounded-lg border border-zinc-200 shadow-lg dark:border-zinc-700"
    />
  );
}
