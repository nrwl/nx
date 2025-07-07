'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = AuthorDetail;
const tslib_1 = require('tslib');
const nx_dev_ui_common_1 = require('@nx/nx-dev-ui-common');
const image_1 = tslib_1.__importDefault(require('next/image'));
function AuthorDetail({ author }) {
  return (
    <div className="space-between invisible absolute left-[65%] right-0 z-30 mt-2 flex w-60 translate-x-[-50%] items-center gap-4 rounded bg-slate-50 p-4 text-sm text-slate-700 opacity-0 shadow-lg ring-1 ring-slate-200 transition-all delay-75 duration-300 ease-in-out md:group-hover:visible md:group-hover:opacity-100 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
      <span>
        <image_1.default
          alt={author.name}
          title={author.name}
          loading="lazy"
          width="40"
          height="40"
          decoding="async"
          src={`/documentation/blog/images/authors/${author.name}.jpeg`}
          className="rounded-full ring-1 ring-white grayscale dark:ring-slate-900"
        />
      </span>
      <span className="text-balance">{author.name}</span>
      <a
        href={`https://twitter.com/${author.twitter}`}
        target="_blank"
        aria-label={`Follow ${author.name} on X`}
      >
        <nx_dev_ui_common_1.XIcon aria-hidden="true" className="h-5 w-5" />
      </a>
      <a
        href={`https://github.com/${author.github}`}
        target="_blank"
        aria-label={`View ${author.name}'s GitHub profile`}
      >
        <nx_dev_ui_common_1.GithubIcon aria-hidden="true" className="h-5 w-5" />
      </a>
    </div>
  );
}
