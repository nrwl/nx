export function Pill({ text, tooltip }: { text: string; tooltip?: string }) {
  return (
    <span
      data-tooltip={tooltip}
      className="rounded-full inline-block text-xs bg-sky-500 dark:bg-sky-800 px-2 py-1 text-slate-50"
    >
      {text}
    </span>
  );
}
