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
    <div className="not-prose mx-auto max-w-4xl pt-4">
      <div className="overflow-hidden rounded-xl bg-zinc-50 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-800/50 dark:ring-zinc-700/50">
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
            <h3 className="text-center text-xl font-medium text-zinc-900 sm:text-left dark:text-white">
              {courseTitle}
            </h3>
            <ButtonLink
              href={courseUrl}
              variant="contrast"
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
