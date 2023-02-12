export const TaskGraphErrorTooltip = ({ error }: { error: string }) => {
  return (
    <>
      <h2 className="border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        There was a problem calculating the task graph for this task
      </h2>
      <p>{error}</p>
    </>
  );
};
