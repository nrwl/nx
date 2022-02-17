import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html
      className="selection:bg-blue-nx-base scroll-smooth selection:text-white"
      lang="en"
    >
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
