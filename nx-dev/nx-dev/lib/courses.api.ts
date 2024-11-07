import { CoursesApi } from '@nx/nx-dev/data-access-courses';

export const coursesApi = new CoursesApi({
  coursesRoot: 'public/documentation/courses',
});
