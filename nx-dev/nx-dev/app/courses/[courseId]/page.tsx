import type { Metadata, ResolvingMetadata } from 'next';
import { coursesApi } from '../../../lib/courses.api';
import { CourseDetails } from '@nx/nx-dev/ui-courses';
import { DefaultLayout } from '@nx/nx-dev/ui-common';

interface CourseDetailProps {
  params: { courseId: string };
}

export async function generateMetadata(
  { params: { courseId } }: CourseDetailProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const course = await coursesApi.getCourse(courseId);
  const previousImages = (await parent).openGraph?.images ?? [];

  return {
    title: `${course.title} | Nx Courses`,
    description: course.description,
    openGraph: {
      url: `https://nx.dev/courses/${courseId}`,
      title: course.title,
      description: course.description,
      images: [
        {
          url: '/path/to/default/course/image.png', // Add a default course image
          width: 800,
          height: 421,
          alt: 'Nx Course: ' + course.title,
          type: 'image/png',
        },
        ...previousImages,
      ],
    },
  };
}

export async function generateStaticParams() {
  const courses = await coursesApi.getAllCourses();
  return courses.map((course) => {
    return { courseId: course.id };
  });
}

export default async function CourseDetail({
  params: { courseId },
}: CourseDetailProps) {
  const course = await coursesApi.getCourse(courseId);
  return course ? (
    <>
      {/* This empty div is necessary as app router does not automatically scroll on route changes */}
      <div></div>
      <DefaultLayout>
        <CourseDetails course={course} />
      </DefaultLayout>
    </>
  ) : null;
}
