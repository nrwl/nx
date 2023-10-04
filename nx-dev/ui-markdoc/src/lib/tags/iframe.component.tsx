export function Iframe(props: any) {
  return (
    <iframe
      {...props}
      title={props.tile}
      frameBorder="0"
      className="rounded-lg border border-slate-200 shadow-lg shadow-lg dark:border-slate-700"
    />
  );
}
