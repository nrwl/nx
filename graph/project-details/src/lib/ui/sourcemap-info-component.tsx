export function SourceItem(props: { source: Array<string> }) {
  return (
    <span className="pl-4 italic text-gray-500">
      Created by {props.source[1]} from {props.source[0]}
    </span>
  );
}
