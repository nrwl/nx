// TODO@ben: add tailwindcss classes
export function YouTube(props: any) {
  return (
    <iframe
      {...props}
      title={props.title}
      frameBorder="0"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      loading="lazy"
    />
  );
}
