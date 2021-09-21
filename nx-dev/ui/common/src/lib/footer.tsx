import cx from 'classnames';
import Link from 'next/link';

export interface FooterProps {
  useDarkBackground?: boolean;
}
export function Footer({ useDarkBackground }: FooterProps) {
  return (
    <footer
      className={cx(
        'pt-16 md:pt-32 text-white body-font',
        useDarkBackground ? 'bg-blue-nx-dark' : 'bg-blue-nx-base'
      )}
    >
      <div className="max-w-screen-sm mx-auto px-5 py-5">
        {/*FOOTER LINKS*/}
        <div className="my-12 flex sm:flex-row flex-col items-start text-center sm:text-left">
          <div className="w-full sm:w-1/3 flex flex-col p-6 mt-8 sm:mt-0">
            <h3 className="text-lg font-extrabold leading-none tracking-tight mb-4">
              Resources
            </h3>
            <ul>
              <li className="mb-2">
                <a
                  href="https://blog.nrwl.io/?utm_source=nx.dev"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  Blog
                </a>
              </li>
              <li>
                <a
                  href="https://nrwl.io/?utm_source=nx.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer block"
                >
                  Nrwl
                </a>
              </li>
            </ul>
          </div>
          <div className="w-full sm:w-1/3 flex flex-col p-6 mt-8 sm:mt-0">
            <h3 className="text-lg font-extrabold leading-none tracking-tight mb-4">
              Help
            </h3>
            <ul>
              <li className="mb-2">
                <Link href={`/getting-started/intro`}>
                  <a className="cursor-pointer block">Documentation</a>
                </Link>
              </li>
              <li className="mb-2">
                <Link href="/community">
                  <a className="cursor-pointer block">Community</a>
                </Link>
              </li>
              <li className="mb-2">
                <a
                  href="https://stackoverflow.com/questions/tagged/nrwl-nx"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  StackOverflow
                </a>
              </li>
              <li className="mb-2">
                <a
                  href="https://github.com/nrwl/nx/issues?q=is%3Aopen+is%3Aissue"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  Report Issues
                </a>
              </li>
            </ul>
          </div>
          <div className="w-full sm:w-1/3 flex flex-col p-6 mt-8 sm:mt-0">
            <h3 className="text-lg font-extrabold leading-none tracking-tight mb-4">
              Community
            </h3>
            <ul>
              <li className="mb-2">
                <a
                  href="https://twitter.com/NXdevtools"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  Twitter
                </a>
              </li>
              <li className="mb-2">
                <a
                  href="https://github.com/nrwl/nx/"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  Github
                </a>
              </li>
              <li className="mb-2">
                <a
                  href="https://github.com/nrwl/nx/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Acommunity"
                  target="_blank"
                  rel="nofollow"
                  className="cursor-pointer block"
                >
                  Help us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 mb-6 w-full text-center">
          Created with
          <svg
            className="mx-1 h-4 w-4 inline align-baseline"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>{' '}
          by
          <a
            href="https://nrwl.io"
            className="text-gray-600 ml-1 point-cursor"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              className="inline-block align-bottom ml-1 h-6 w-12 text-white"
              fill="currentcolor"
              viewBox="0 0 402.32 125.56"
            >
              <g>
                <polygon points="123.57 110.54 123.57 125.56 146.66 125.56 146.66 112.72 123.57 110.54" />
                <path d="M95,102.39l-.14,0c-.08-1.78-1.64-3-2.23-3.76a2.31,2.31,0,0,1-.54-1.18h0A27.52,27.52,0,0,0,67,72h0A8.38,8.38,0,0,0,64,68.75a8.43,8.43,0,0,1-3.19-6.63v0a9.41,9.41,0,0,0-8.34,7.36,23.35,23.35,0,0,1-6.32-37.28,30.16,30.16,0,0,1,22-9.42A30.55,30.55,0,0,1,97.73,45.42a15.3,15.3,0,0,1-9.11,5.36A15.15,15.15,0,0,0,76.28,63.32c5.88,0,9.79,8,20.71,8a9.91,9.91,0,0,0,9.18-6.16,9.93,9.93,0,0,0,9.19,6.16,19.61,19.61,0,0,0,8.56-1.9V50.82l-.19,0C119,50,114.27,46.52,112.67,42h0a57.41,57.41,0,1,0-91.78,59.89,11.81,11.81,0,0,1-3.46-1.25,11.4,11.4,0,0,0-6.55-1.5A11.67,11.67,0,0,0,.78,115a33.3,33.3,0,0,1,9.48-2,33.79,33.79,0,0,1,5.7.1h0a29.56,29.56,0,0,0,4.71.07q1.24-.09,2.46-.27a28.79,28.79,0,0,0,9.82-3.4,54.59,54.59,0,0,0,7.35,2.8A74.29,74.29,0,0,0,90.38,109a8.94,8.94,0,0,0,2-1.25,2.94,2.94,0,0,0,1.24.49L165.42,115ZM29.54,47.26c.11-1.54,1.07-2.72,2.14-2.65s1.86,1.39,1.75,2.93-1.07,2.72-2.15,2.65S29.43,48.8,29.54,47.26ZM30,69.66c1.09-.89,3-.36,4.3,1.2s1.44,3.55.35,4.45-3,.36-4.3-1.2S28.94,70.56,30,69.66Zm-5.33-20c.54,0,1,.59,1,1.36s-.38,1.41-.92,1.43-1-.58-1-1.35S24.17,49.66,24.7,49.63Zm-.78,8.86c1-.24,2.18.78,2.53,2.28s-.22,2.92-1.27,3.16-2.18-.77-2.53-2.28S22.87,58.74,23.92,58.49Zm40.78,41.7a2.87,2.87,0,0,1-5.57-1.35c.35-1.46,1.52-.84,3.06-.46S65.05,98.74,64.7,100.19Z" />
                <polygon points="179.75 43.56 179.75 87.26 142.97 43.56 123.57 43.56 123.57 103.1 146.66 108.56 146.66 81.87 183.44 125.56 202.84 125.56 202.84 43.56 179.75 43.56" />
                <path d="M244.47,63.19A34.5,34.5,0,0,1,257.15,61v20A48.15,48.15,0,0,0,252,80.7q-7.26,0-11.37,3.86T236.55,96.4v29.16H213.94V62.07h21.54v7.62A21,21,0,0,1,244.47,63.19Z" />
                <path d="M362.16,62.07l-18.35,63.49h-21.9l-7.53-29.1-8,29.1H284.48L266.13,62.07h21.43l8.59,32.06,9.07-32.06H324.5l8.71,32.41,9.07-32.41Z" />
                <path d="M393.28,28.64H370.61v74c0,19.88,12.84,22.41,24.89,22.41,3.67,0,6.82-.35,6.82-.35V107.44s-1.31.12-2.75.12c-5.11,0-6.29-2-6.29-7.59Z" />
              </g>
            </svg>
          </a>
        </div>
        <div className="w-full text-center">© 2021</div>
      </div>
    </footer>
  );
}

export default Footer;
