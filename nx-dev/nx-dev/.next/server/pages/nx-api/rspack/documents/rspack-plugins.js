"use strict";(()=>{var e={};e.id=6634,e.ids=[6634],e.modules={25616:(e,t,r)=>{r.a(e,async(e,s)=>{try{r.r(t),r.d(t,{config:()=>x,default:()=>l,getServerSideProps:()=>h,getStaticPaths:()=>g,getStaticProps:()=>d,reportWebVitals:()=>f,routeModule:()=>P,unstable_getServerProps:()=>w,unstable_getServerSideProps:()=>b,unstable_getStaticParams:()=>v,unstable_getStaticPaths:()=>k,unstable_getStaticProps:()=>m});var i=r(18877),a=r(84591),n=r(6021),o=r(51826),c=r(44998),p=r(19923),u=e([p]);p=(u.then?(await u)():u)[0];let l=(0,n.l)(p,"default"),d=(0,n.l)(p,"getStaticProps"),g=(0,n.l)(p,"getStaticPaths"),h=(0,n.l)(p,"getServerSideProps"),x=(0,n.l)(p,"config"),f=(0,n.l)(p,"reportWebVitals"),m=(0,n.l)(p,"unstable_getStaticProps"),k=(0,n.l)(p,"unstable_getStaticPaths"),v=(0,n.l)(p,"unstable_getStaticParams"),w=(0,n.l)(p,"unstable_getServerProps"),b=(0,n.l)(p,"unstable_getServerSideProps"),P=new i.PagesRouteModule({definition:{kind:a.x.PAGES,page:"/nx-api/rspack/documents/rspack-plugins",pathname:"/nx-api/rspack/documents/rspack-plugins",bundlePath:"",filename:""},components:{App:c.default,Document:o.default},userland:p});s()}catch(e){s(e)}})},62993:(e,t,r)=>{function s(e,t){if(void 0!==t.title)return t.title;let r=e.split("/"),s=r[r.length-1],i=r[r.length-2],a=r[r.length-3];return["properties","definitions"].includes(i)?s:"additionalProperties"===s?"(Additional properties)":"items"===s&&["properties","definitions"].includes(a)?i+" items":void 0}function i(e){return"boolean"==typeof e?e?"Anything is allowed here.":"There is no valid value for this property.":0===Object.keys(e).length?"Anything is allowed here.":e.description??"No description available."}r.d(t,{cR:()=>c,r1:()=>u,LS:()=>i,p$:()=>n,ir:()=>o,A:()=>s,wY:()=>p});var a=r(60131);function n(e,t){return o(t.getSchema({$ref:e}))}function o(e){return void 0===e?void 0:e.schema}class c{constructor(e){this.schema=e}getSchema(e){if(void 0===e)return;if("boolean"==typeof e||void 0===e.$ref)return{schema:e};let t=e.$ref;if(!t.startsWith("#")){console.error("[SCHEMA] The schema appears to have non-internal references which is not supported:",t);return}let r=(0,a.get)(this.schema,t.slice(1));if(void 0===r)return;let s=this.getSchema(r);if(void 0!==s)return{schema:s.schema,baseReference:s.baseReference??t}}}function p(e,t){let r=["nx","workspace","devkit","nx-plugin"];function s(e,t){if(!(e in t))throw Error(`Property '${e.toString()}' can not be found in passed object.`);return!0}return[...r.map(r=>e.find(e=>s(t,e)&&e[t]===r)),...e.filter(e=>s(t,e)&&!r.includes(String(e[t])))].filter(e=>!!e)}function u(e){let t=["create-nx-workspace","create-nx-plugin","tao"];return e.filter(e=>!t.includes(e.name))}},64198:(e,t,r)=>{r.d(t,{k:()=>s});let s=`
# Rspack plugins

Nx uses enhanced Rspack configuration files (e.g. \`rspack.config.js\`). These configuration files export a _plugin_ that takes in a rspack
configuration object and returns an updated configuration object. Plugins are used by Nx to add
functionality to the Rspack build.

This guide contains information on the plugins provided by Nx. For more information on customizing Rspack configuration, refer to the
[Nx Rspack configuration guide](/nx-api/rspack/documents/rspack-config-setup).

## withNx

The \`withNx\` plugin provides common configuration for the build, including TypeScript support and linking workspace libraries (via tsconfig paths).

### Example

\`\`\`js
const { composePlugins, withNx } = require('@nx/rspack');

module.exports = composePlugins(withNx(), (config) => {
  // Further customize Rspack config
  return config;
});
\`\`\`

## withWeb

The \`withWeb\` plugin adds support for CSS/SASS/Less stylesheets, assets (such as images and fonts), and \`index.html\` processing.

### Options

#### stylePreprocessorOptions

Type: \`{ includePaths: string[] }\`

Options to pass to style preprocessors. \`includePaths\` is a list of paths that are included (e.g. workspace libs with stylesheets).

### Example

\`\`\`js
const { composePlugins, withNx, withWeb } = require('@nx/rspack');

module.exports = composePlugins(
  // always pass withNx() first
  withNx(),
  // add web functionality
  withWeb({
    stylePreprocessorOptions: ['ui/src'],
  }),
  (config) => {
    // Further customize Rspack config
    return config;
  }
);
\`\`\`

## withReact

The \`withReact\` plugin adds support for React JSX and [Fast Refresh](https://github.com/pmmmwh/react-refresh-webpack-plugin)
### Example

\`\`\`js
const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(), // always pass withNx() first
  withReact({
    stylePreprocessorOptions: ['ui/src'],
  }),
  (config) => {
    // Further customize Rspack config
    return config;
  }
);
\`\`\`
`},80291:(e,t,r)=>{r.d(t,{K:()=>s});let s={description:"",documents:{"/nx-api/rspack/documents/overview":{id:"overview",name:"Overview of the Nx Rspack plugin",description:"The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/overview",tags:[]},"/nx-api/rspack/documents/rspack-plugins":{id:"rspack-plugins",name:"Rspack plugins",description:"Rspack plugins",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-plugins",tags:[]},"/nx-api/rspack/documents/rspack-config-setup":{id:"rspack-config-setup",name:" How to configure Rspack on your Nx workspace",description:"A guide on how to configure rspack on your Nx workspace, and instructions on how to customize your rspack configuration.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-config-setup",tags:[]}},executors:{"/nx-api/rspack/executors/rspack":{description:"Run rspack build.",file:"generated/packages/rspack/executors/rspack.json",hidden:!1,name:"rspack",originalFilePath:"/nx-api/rspack/src/executors/rspack/schema.json",path:"/nx-api/rspack/executors/rspack",type:"executor"},"/nx-api/rspack/executors/dev-server":{description:"Serve a web application.",file:"generated/packages/rspack/executors/dev-server.json",hidden:!1,name:"dev-server",originalFilePath:"/nx-api/rspack/src/executors/dev-server/schema.json",path:"/nx-api/rspack/executors/dev-server",type:"executor"}},generators:{"/nx-api/rspack/generators/init":{description:"Initialize the `@nx/rspack` plugin.",file:"generated/packages/rspack/generators/init.json",hidden:!1,name:"init",originalFilePath:"/nx-api/rspack/src/generators/init/schema.json",path:"/nx-api/rspack/generators/init",type:"generator"},"/nx-api/rspack/generators/configuration":{description:"Add Rspack configuration to a project.",file:"generated/packages/rspack/generators/configuration.json",hidden:!1,name:"configuration",originalFilePath:"/nx-api/rspack/src/generators/configuration/schema.json",path:"/nx-api/rspack/generators/configuration",type:"generator"},"/nx-api/rspack/generators/application":{description:"Add Rspack application to a project.",file:"generated/packages/rspack/generators/application.json",hidden:!1,name:"application",originalFilePath:"/nx-api/rspack/src/generators/application/schema.json",path:"/nx-api/rspack/generators/application",type:"generator"}},githubRoot:"https://github.com/nrwl/nx-labs/tree/main/packages/rspack",name:"rspack",packageName:"@nx/rspack",path:"",root:"",source:""}},19923:(e,t,r)=>{r.a(e,async(e,s)=>{try{r.r(t),r.d(t,{default:()=>f,getStaticProps:()=>m});var i=r(20997),a=r(48928),n=r(62993),o=r(30444),c=r(65628),p=r(95369),u=r(3553),l=r(64198),d=r(80291),g=r(41068),h=r(26386),x=e([o,c]);function f({document:e,menu:t,relatedDocuments:r,widgetData:s}){let{toggleNav:p,navIsOpen:l}=(0,u.s)(),d={document:e,menu:{sections:(0,n.wY)((0,a.OP)(t),"id")},relatedDocuments:r};return(0,i.jsxs)("div",{id:"shell",className:"flex h-full flex-col",children:[i.jsx("div",{className:"w-full flex-shrink-0",children:i.jsx(c.aV,{isNavOpen:l,toggleNav:p})}),(0,i.jsxs)("main",{id:"main",role:"main",className:"flex h-full flex-1 overflow-y-hidden",children:[i.jsx(c._G,{menu:d.menu,navIsOpen:l,toggleNav:p}),i.jsx(h.t,{resetScrollOnNavigation:!0,children:i.jsx(o.z,{document:d.document,relatedDocuments:d.relatedDocuments,widgetData:s})})]})]})}async function m(){let e={content:l.k,description:"Rspack plugins",filePath:"",id:"rspack-plugins",name:"Rspack plugins",relatedDocuments:{},tags:[]};return{props:{pkg:d.K,document:e,widgetData:{githubStarsCount:await (0,g.P)()},relatedDocuments:[],menu:p.m.getMenu("nx-api","")}}}[o,c]=x.then?(await x)():x,s()}catch(e){s(e)}})},26386:(e,t,r)=>{r.d(t,{t:()=>o});var s=r(20997),i=r(16689),a=r(5632),n=r(62661);function o(e){let t=(0,i.useRef)(null),r=(0,a.useRouter)(),o=(0,i.useRef)(0),c=(0,i.useRef)(!0);return s.jsx("div",{ref:t,id:"wrapper","data-testid":"wrapper",className:"relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll",onScroll:e=>{var t;if(!c.current)return;let{scrollHeight:s,scrollTop:i,offsetHeight:a}=e.currentTarget,p=(t=(i+a)/s)>=.9?90:t<.25?0:t<.5?25:t<.75?50:75;p>o.current&&(o.current=p,(0,n.K)(`scroll_${p}`,"scroll",r.asPath))},children:e.children})}},68781:e=>{e.exports=require("@docsearch/react")},45360:e=>{e.exports=require("@markdoc/markdoc")},5411:e=>{e.exports=require("@nx/graph/shared")},34928:e=>{e.exports=require("@nx/graph/ui-components")},80760:e=>{e.exports=require("@nx/graph/ui-graph")},35864:e=>{e.exports=require("@nx/graph/ui-icons")},68994:e=>{e.exports=require("@nx/graph/ui-tooltips")},59003:e=>{e.exports=require("classnames")},60131:e=>{e.exports=require("jsonpointer")},16641:e=>{e.exports=require("next-seo")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},62785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},40968:e=>{e.exports=require("next/head")},84287:e=>{e.exports=require("octokit")},16689:e=>{e.exports=require("react")},42807:e=>{e.exports=require("react-copy-to-clipboard")},66405:e=>{e.exports=require("react-dom")},90727:e=>{e.exports=require("react-syntax-highlighter")},20997:e=>{e.exports=require("react/jsx-runtime")},90748:e=>{e.exports=import("@zkochan/js-yaml")},66197:e=>{e.exports=import("framer-motion")},68097:e=>{e.exports=import("tailwind-merge")},57147:e=>{e.exports=require("fs")},71017:e=>{e.exports=require("path")},12781:e=>{e.exports=require("stream")},59796:e=>{e.exports=require("zlib")}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[2546,413,331,4343,324,4880,8799,6641],()=>r(25616));module.exports=s})();