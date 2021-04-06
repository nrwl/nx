import React from 'react';
import Content from './content';
import Sidebar from './sidebar';
import Toc from './toc';

/* eslint-disable-next-line */
export interface DocumentationFeatureDocViewerProps {
  sidebar: any;
  content: any;
  toc: any;
}

export function DocViewer(props: DocumentationFeatureDocViewerProps) {
  return (
    <div className="w-full max-w-screen-xl max-w-8xl mx-auto">
      <div className="lg:flex">
        <Sidebar />
        <div
          id="content-wrapper"
          className="min-w-0 w-full flex-auto lg:static lg:max-h-full lg:overflow-visible"
        >
          <div className="w-full flex">
            <Content data={props.content} />
            <div className="hidden xl:text-sm xl:block flex-none w-64 pl-8 mr-8">
              <div className="flex flex-col justify-between overflow-y-auto sticky max-h-(screen-18) pt-10 pb-6 top-18">
                <Toc />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocViewer;
