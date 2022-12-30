export function YouTube(props: any): JSX.Element {
  return (
    <iframe
      {...props}
      title={props.title}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      loading="lazy"
      className="rounded-lg shadow-lg"
    />
  );
}
