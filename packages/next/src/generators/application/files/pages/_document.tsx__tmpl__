/* eslint-disable react/display-name */
import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

export default class CustomDocument extends Document {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
   const originalRenderPage = ctx.renderPage;

   const sheet = new ServerStyleSheet();

   ctx.renderPage = () => originalRenderPage({
    enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
    enhanceComponent: (Component) => Component,
   });

   const intialProps = await Document.getInitialProps(ctx);
   const styles = sheet.getStyleElement();

   return {...intialProps, styles };
  }

  render() {
    return (
      <Html>
        <Head>{this.props.styles}</Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
