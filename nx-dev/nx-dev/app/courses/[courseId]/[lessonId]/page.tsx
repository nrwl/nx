import { coursesApi } from '../../../../lib/courses.api';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { LessonPlayer } from '@nx/nx-dev/ui-courses';
import { Metadata } from 'next';

interface LessonPageProps {
  params: { courseId: string; lessonId: string };
}

export async function generateMetadata({
  params,
}: LessonPageProps): Promise<Metadata> {
  const course = await coursesApi.getCourse(params.courseId);
  const lesson = course.lessons.find((l) => l.id === params.lessonId);

  if (!lesson) {
    return {
      title: 'Lesson Not Found',
    };
  }

  return {
    title: `${lesson.title} | ${course.title} | Nx Courses`,
    description: lesson.description.substring(0, 160),
  };
}

export async function generateStaticParams() {
  const courses = await coursesApi.getAllCourses();
  return courses.flatMap((course) =>
    course.lessons.map((lesson) => ({
      courseId: course.id,
      lessonId: lesson.id,
    }))
  );
}

export default async function LessonPage({ params }: LessonPageProps) {
  const course = await coursesApi.getCourse(params.courseId);
  const lesson = course.lessons.find((l) => l.id === params.lessonId);

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  return (
    <DefaultLayout hideHeader hideFooter>
      <LessonPlayer course={course} lesson={lesson} />
    </DefaultLayout>
  );
}
