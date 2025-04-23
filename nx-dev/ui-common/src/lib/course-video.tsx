import { ButtonLink } from './button';
import { YouTube } from './youtube.component';

export interface CourseVideoProps {
  /**
   * The YouTube video URL
   */
  src: string;
  courseTitle: string;
  courseUrl: string;
}

export function CourseVideo({
  src: videoUrl,
  courseTitle,
  courseUrl,
}: CourseVideoProps): JSX.Element {
  return (
    <div className="not-prose mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-xl bg-slate-50 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800/50 dark:ring-slate-700/50">
        <div className="aspect-video w-full">
          <YouTube
            src={videoUrl}
            title={courseTitle}
            width="100%"
            disableRoundedCorners={true}
          />
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-center text-xl font-medium text-slate-900 sm:text-left dark:text-white">
              {courseTitle}
            </h3>
            <ButtonLink
              href={courseUrl}
              variant="primary"
              size="small"
              title={`Watch the full "${courseTitle}" course`}
              className="whitespace-nowrap"
            >
              Watch full course
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
