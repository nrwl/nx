export function SourceInfo(props: { data: Array<string> }) {
  return (
    <span className="italic text-gray-500">
      Created by {props.data[1]} from {props.data[0]}
    </span>
  );
}
