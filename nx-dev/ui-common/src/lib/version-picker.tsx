'use client';
import { Selector } from './selector';
import { useRouter } from 'next/navigation';

const versionOptions = [
  {
    label: '20',
    value: '',
  },
  {
    label: '19',
    value: '19',
  },
  {
    label: '18',
    value: '18',
  },
  {
    label: '17',
    value: '17',
  },
];

export function VersionPicker(): JSX.Element {
  const router = useRouter();
  function versionChange(item: { label: string; value: string }) {
    if (item.value === '') {
      return;
    }
    router.push(`https://${item.value}.nx.dev`);
  }
  return (
    <>
      <span className="inline-block align-bottom text-sm font-semibold uppercase leading-[38px] tracking-wide text-slate-800 lg:text-xs lg:leading-[38px] dark:text-slate-200"></span>
      <div className="ml-2 inline-block">
        <Selector
          className="rounded-lg"
          items={versionOptions}
          selected={versionOptions[0]}
          onChange={versionChange}
        >
          <div></div>
        </Selector>
      </div>
    </>
  );
}
