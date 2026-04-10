"use strict";(()=>{var e={};e.id=2932,e.ids=[2932],e.modules={62988:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{config:()=>x,default:()=>u,getServerSideProps:()=>h,getStaticPaths:()=>g,getStaticProps:()=>d,reportWebVitals:()=>k,routeModule:()=>b,unstable_getServerProps:()=>w,unstable_getServerSideProps:()=>y,unstable_getStaticParams:()=>v,unstable_getStaticPaths:()=>m,unstable_getStaticProps:()=>f});var s=r(18877),n=r(84591),i=r(6021),o=r(51826),c=r(44998),p=r(19235),l=e([p]);p=(l.then?(await l)():l)[0];let u=(0,i.l)(p,"default"),d=(0,i.l)(p,"getStaticProps"),g=(0,i.l)(p,"getStaticPaths"),h=(0,i.l)(p,"getServerSideProps"),x=(0,i.l)(p,"config"),k=(0,i.l)(p,"reportWebVitals"),f=(0,i.l)(p,"unstable_getStaticProps"),m=(0,i.l)(p,"unstable_getStaticPaths"),v=(0,i.l)(p,"unstable_getStaticParams"),w=(0,i.l)(p,"unstable_getServerProps"),y=(0,i.l)(p,"unstable_getServerSideProps"),b=new s.PagesRouteModule({definition:{kind:n.x.PAGES,page:"/nx-api/rspack/documents/overview",pathname:"/nx-api/rspack/documents/overview",bundlePath:"",filename:""},components:{App:c.default,Document:o.default},userland:p});a()}catch(e){a(e)}})},62993:(e,t,r)=>{function a(e,t){if(void 0!==t.title)return t.title;let r=e.split("/"),a=r[r.length-1],s=r[r.length-2],n=r[r.length-3];return["properties","definitions"].includes(s)?a:"additionalProperties"===a?"(Additional properties)":"items"===a&&["properties","definitions"].includes(n)?s+" items":void 0}function s(e){return"boolean"==typeof e?e?"Anything is allowed here.":"There is no valid value for this property.":0===Object.keys(e).length?"Anything is allowed here.":e.description??"No description available."}r.d(t,{cR:()=>c,r1:()=>l,LS:()=>s,p$:()=>i,ir:()=>o,A:()=>a,wY:()=>p});var n=r(60131);function i(e,t){return o(t.getSchema({$ref:e}))}function o(e){return void 0===e?void 0:e.schema}class c{constructor(e){this.schema=e}getSchema(e){if(void 0===e)return;if("boolean"==typeof e||void 0===e.$ref)return{schema:e};let t=e.$ref;if(!t.startsWith("#")){console.error("[SCHEMA] The schema appears to have non-internal references which is not supported:",t);return}let r=(0,n.get)(this.schema,t.slice(1));if(void 0===r)return;let a=this.getSchema(r);if(void 0!==a)return{schema:a.schema,baseReference:a.baseReference??t}}}function p(e,t){let r=["nx","workspace","devkit","nx-plugin"];function a(e,t){if(!(e in t))throw Error(`Property '${e.toString()}' can not be found in passed object.`);return!0}return[...r.map(r=>e.find(e=>a(t,e)&&e[t]===r)),...e.filter(e=>a(t,e)&&!r.includes(String(e[t])))].filter(e=>!!e)}function l(e){let t=["create-nx-workspace","create-nx-plugin","tao"];return e.filter(e=>!t.includes(e.name))}},98506:(e,t,r)=>{r.d(t,{k:()=>a});let a=`
The Nx plugin for Rspack.

[Rspack](https://www.rspack.dev/) is a fast build tool written in [Rust](https://www.rust-lang.org/) that is interoperable with the Webpack ecosystem.

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Rspack.
- Out-of-the-box support for TypeScript, JSX, CSS, and more.
- Compatible with the Webpack ecosystem.

Read more about it in the [Rspack documentation](https://www.rspack.dev/).

## Setting up a new Nx workspace with Rspack

You can create a new React workspace that uses Rspack using this command:

\`\`\`shell
npx create-nx-workspace@latest --preset=@nx/rspack
\`\`\`

You will be prompted for a repository name, which will be used for the folder and application name.

## Add Rspack to an existing workspace

There are a number of ways to use Rspack in your existing workspace.


First, make sure \`@nx/rspack\` is installed.

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the \`@nx/rspack\` version that matches the version of \`nx\` in your repository.  If the version numbers get out of sync, you can encounter some difficult to debug errors.  You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

\`\`\`bash
nx add @nx/rspack
\`\`\`


### Generate a new React project using Rspack

The easiest way to generate a new application that uses Rspack is by using the \`@nx/rspack:app\` generator.

\`\`\`bash
nx g @nx/rspack:app my-app --style=css
\`\`\`

Then you should be able to serve, test, and build the application.

\`\`\`bash
nx serve my-app
nx test my-app
nx build my-app
\`\`\`

### Generate a non-React project using Rspack

You can generate a [Web](/nx-api/web) application, and then use the \`@nx/rspack:configuration\` generator to configure the build and serve targets.

Make sure you have the Web plugin installed.

\`\`\`bash
nx add @nx/web
\`\`\`

Then generate the application.

\`\`\`bash
nx g @nx/web:app my-app --style=css
\`\`\`

Finally, configure Rspack for the new project.

\`\`\`bash
nx g @nx/rspack:configuration --project=my-app
\`\`\`

### Modify an existing React or Web project to use Rspack

You can use the \`@nx/rspack:configuration\` generator to change your React or Web project to use Rspack.
This generator will modify your project's configuration to use Rspack, and it will also install all the necessary dependencies.

You can read more about this generator on the [\`@nx/rspack:configuration\`](/nx-api/rspack/generators/configuration) generator page.

### Initialize Rspack

If you do not want to create any new projects or convert any existing projects yet, you can still use Nx to install all the necessary dependencies for Rspack.
This, for example, could be useful if you want to set up Rspack manually for a project.

\`\`\`bash
nx g @nx/rspack:init
\`\`\`
`},80291:(e,t,r)=>{r.d(t,{K:()=>a});let a={description:"",documents:{"/nx-api/rspack/documents/overview":{id:"overview",name:"Overview of the Nx Rspack plugin",description:"The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/overview",tags:[]},"/nx-api/rspack/documents/rspack-plugins":{id:"rspack-plugins",name:"Rspack plugins",description:"Rspack plugins",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-plugins",tags:[]},"/nx-api/rspack/documents/rspack-config-setup":{id:"rspack-config-setup",name:" How to configure Rspack on your Nx workspace",description:"A guide on how to configure rspack on your Nx workspace, and instructions on how to customize your rspack configuration.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-config-setup",tags:[]}},executors:{"/nx-api/rspack/executors/rspack":{description:"Run rspack build.",file:"generated/packages/rspack/executors/rspack.json",hidden:!1,name:"rspack",originalFilePath:"/nx-api/rspack/src/executors/rspack/schema.json",path:"/nx-api/rspack/executors/rspack",type:"executor"},"/nx-api/rspack/executors/dev-server":{description:"Serve a web application.",file:"generated/packages/rspack/executors/dev-server.json",hidden:!1,name:"dev-server",originalFilePath:"/nx-api/rspack/src/executors/dev-server/schema.json",path:"/nx-api/rspack/executors/dev-server",type:"executor"}},generators:{"/nx-api/rspack/generators/init":{description:"Initialize the `@nx/rspack` plugin.",file:"generated/packages/rspack/generators/init.json",hidden:!1,name:"init",originalFilePath:"/nx-api/rspack/src/generators/init/schema.json",path:"/nx-api/rspack/generators/init",type:"generator"},"/nx-api/rspack/generators/configuration":{description:"Add Rspack configuration to a project.",file:"generated/packages/rspack/generators/configuration.json",hidden:!1,name:"configuration",originalFilePath:"/nx-api/rspack/src/generators/configuration/schema.json",path:"/nx-api/rspack/generators/configuration",type:"generator"},"/nx-api/rspack/generators/application":{description:"Add Rspack application to a project.",file:"generated/packages/rspack/generators/application.json",hidden:!1,name:"application",originalFilePath:"/nx-api/rspack/src/generators/application/schema.json",path:"/nx-api/rspack/generators/application",type:"generator"}},githubRoot:"https://github.com/nrwl/nx-labs/tree/main/packages/rspack",name:"rspack",packageName:"@nx/rspack",path:"",root:"",source:""}},19235:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{default:()=>k,getStaticProps:()=>f});var s=r(20997),n=r(48928),i=r(62993),o=r(30444),c=r(65628),p=r(95369),l=r(3553),u=r(98506),d=r(80291),g=r(41068),h=r(26386),x=e([o,c]);function k({document:e,menu:t,relatedDocuments:r,widgetData:a}){let{toggleNav:p,navIsOpen:u}=(0,l.s)(),d={document:e,menu:{sections:(0,i.wY)((0,n.OP)(t),"id")},relatedDocuments:r};return(0,s.jsxs)("div",{id:"shell",className:"flex h-full flex-col",children:[s.jsx("div",{className:"w-full flex-shrink-0",children:s.jsx(c.aV,{isNavOpen:u,toggleNav:p})}),(0,s.jsxs)("main",{id:"main",role:"main",className:"flex h-full flex-1 overflow-y-hidden",children:[s.jsx(c._G,{menu:d.menu,navIsOpen:u,toggleNav:p}),s.jsx(h.t,{resetScrollOnNavigation:!0,children:s.jsx(o.z,{document:d.document,relatedDocuments:d.relatedDocuments,widgetData:a})})]})]})}async function f(){let e={content:u.k,description:"",filePath:"",id:"overview",name:"Overview of the Nx Rspack Plugin",relatedDocuments:{},tags:[]};return{props:{pkg:d.K,document:e,widgetData:{githubStarsCount:await (0,g.P)()},relatedDocuments:[],menu:p.m.getMenu("nx-api","")}}}[o,c]=x.then?(await x)():x,a()}catch(e){a(e)}})},26386:(e,t,r)=>{r.d(t,{t:()=>o});var a=r(20997),s=r(16689),n=r(5632),i=r(62661);function o(e){let t=(0,s.useRef)(null),r=(0,n.useRouter)(),o=(0,s.useRef)(0),c=(0,s.useRef)(!0);return a.jsx("div",{ref:t,id:"wrapper","data-testid":"wrapper",className:"relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll",onScroll:e=>{var t;if(!c.current)return;let{scrollHeight:a,scrollTop:s,offsetHeight:n}=e.currentTarget,p=(t=(s+n)/a)>=.9?90:t<.25?0:t<.5?25:t<.75?50:75;p>o.current&&(o.current=p,(0,i.K)(`scroll_${p}`,"scroll",r.asPath))},children:e.children})}},68781:e=>{e.exports=require("@docsearch/react")},45360:e=>{e.exports=require("@markdoc/markdoc")},5411:e=>{e.exports=require("@nx/graph/shared")},34928:e=>{e.exports=require("@nx/graph/ui-components")},80760:e=>{e.exports=require("@nx/graph/ui-graph")},35864:e=>{e.exports=require("@nx/graph/ui-icons")},68994:e=>{e.exports=require("@nx/graph/ui-tooltips")},59003:e=>{e.exports=require("classnames")},60131:e=>{e.exports=require("jsonpointer")},16641:e=>{e.exports=require("next-seo")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},62785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},40968:e=>{e.exports=require("next/head")},84287:e=>{e.exports=require("octokit")},16689:e=>{e.exports=require("react")},42807:e=>{e.exports=require("react-copy-to-clipboard")},66405:e=>{e.exports=require("react-dom")},90727:e=>{e.exports=require("react-syntax-highlighter")},20997:e=>{e.exports=require("react/jsx-runtime")},90748:e=>{e.exports=import("@zkochan/js-yaml")},66197:e=>{e.exports=import("framer-motion")},68097:e=>{e.exports=import("tailwind-merge")},57147:e=>{e.exports=require("fs")},71017:e=>{e.exports=require("path")},12781:e=>{e.exports=require("stream")},59796:e=>{e.exports=require("zlib")}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[2546,413,331,4343,324,4880,8799,6641],()=>r(62988));module.exports=a})();