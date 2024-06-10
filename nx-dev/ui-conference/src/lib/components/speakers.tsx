import { Member, MemberCard } from '@nx/nx-dev/ui-member-card';

export function Speakers(speakers: Array<Member>) {
  function chunkList<ITEM>(itemList: ITEM[], chunkSize: number): Array<ITEM[]> {
    const result: Array<ITEM[]> = [];
    for (let i = 0; i < itemList.length; i += chunkSize)
      result.push(itemList.slice(i, i + chunkSize));
    return result;
  }

  const rows = chunkList(speakers, 2);
  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      {rows.map((row, rowIndex) => (
        <div
          key={'speaker-row--' + rowIndex}
          className="border-b border-slate-200 dark:border-slate-700"
        >
          <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {row.map((speaker) => (
                <div
                  key={speaker.name}
                  className="border-slate-200 py-8 odd:border-b md:odd:border-b-0 md:odd:border-r md:odd:pr-12 md:even:pl-12 dark:border-slate-700"
                >
                  <div className="px-5">
                    <MemberCard
                      imageUrl={speaker.imageUrl}
                      name={speaker.name}
                      description={speaker.description}
                      twitter={speaker.twitter}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
