import { Schema } from '@markdoc/markdoc';

export const courseVideo: Schema = {
  render: 'CourseVideo',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    courseTitle: {
      type: 'String',
      required: true,
    },
    courseUrl: {
      type: 'String',
      required: true,
    },
  },
};
