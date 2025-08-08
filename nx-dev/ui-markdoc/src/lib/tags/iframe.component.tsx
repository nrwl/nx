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
      className="rounded-lg border border-slate-200 shadow-lg shadow-lg dark:border-slate-700"
    />
  );
}
