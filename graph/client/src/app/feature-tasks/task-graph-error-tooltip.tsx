export const TaskGraphErrorTooltip = ({ error }: { error: string }) => {
  return (
    <>
      <h2 className="text-lg font-light text-slate-400 dark:text-slate-500">
        There was a problem calculating the task graph for this task
      </h2>
      <p>{error}</p>
    </>
  );
};
