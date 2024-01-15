export function LaunchWeekAnnouncements(): JSX.Element {
  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <section className="w-full divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <article className="md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
            <div className="px-5 py-12 md:pr-12">
              <p>
                We’ll be sharing new features and content daily during launch
                week, so be sure to keep an eye on this space for all the latest
                info!
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
