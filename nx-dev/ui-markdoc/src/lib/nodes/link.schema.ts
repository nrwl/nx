export const link = {
  render: 'CustomLink',
  description: 'Displays a Next.js link',
  attributes: {
    href: {
      description: 'The path or URL to navigate to.',
      type: String,
      errorLevel: 'critical',
      required: true,
    },
    as: {
      description:
        'Optional decorator for the path that will be shown in the browser URL bar.',
      type: String,
    },
    passHref: {
      description: 'Forces Link to send the href property to its child.',
      type: Boolean,
      default: false,
    },
    prefetch: {
      description: 'Prefetch the page in the background.',
      type: Boolean,
    },
    replace: {
      description:
        'Replace the current history state instead of adding a new url into the stack.',
      type: Boolean,
      default: false,
    },
    scroll: {
      description: 'Scroll to the top of the page after a navigation.',
      type: Boolean,
      default: true,
    },
    shallow: {
      description:
        'Update the path of the current page without rerunning getStaticProps, getServerSideProps or getInitialProps.',
      type: Boolean,
      default: false,
    },
    locale: {
      description: 'The active locale is automatically prepended.',
      type: Boolean,
    },
  },
};
