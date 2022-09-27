/* eslint-disable-next-line */
export interface TagProps {}

export function Tag(props) {
  return (
    <span className="font- mr-3 inline-block rounded-md bg-slate-300 p-2 font-sans text-xs font-semibold uppercase leading-4 tracking-wide text-slate-700">
      {props.children}
    </span>
  );
}

export default Tag;
