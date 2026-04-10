"use strict";(()=>{var e={};e.id=5277,e.ids=[5277],e.modules={69487:(e,t,r)=>{r.a(e,async(e,o)=>{try{r.r(t),r.d(t,{config:()=>f,default:()=>l,getServerSideProps:()=>h,getStaticPaths:()=>d,getStaticProps:()=>g,reportWebVitals:()=>x,routeModule:()=>R,unstable_getServerProps:()=>v,unstable_getServerSideProps:()=>y,unstable_getStaticParams:()=>w,unstable_getStaticPaths:()=>m,unstable_getStaticProps:()=>k});var n=r(18877),s=r(84591),i=r(6021),a=r(51826),c=r(44998),p=r(21619),u=e([p]);p=(u.then?(await u)():u)[0];let l=(0,i.l)(p,"default"),g=(0,i.l)(p,"getStaticProps"),d=(0,i.l)(p,"getStaticPaths"),h=(0,i.l)(p,"getServerSideProps"),f=(0,i.l)(p,"config"),x=(0,i.l)(p,"reportWebVitals"),k=(0,i.l)(p,"unstable_getStaticProps"),m=(0,i.l)(p,"unstable_getStaticPaths"),w=(0,i.l)(p,"unstable_getStaticParams"),v=(0,i.l)(p,"unstable_getServerProps"),y=(0,i.l)(p,"unstable_getServerSideProps"),R=new n.PagesRouteModule({definition:{kind:s.x.PAGES,page:"/nx-api/rspack/documents/rspack-config-setup",pathname:"/nx-api/rspack/documents/rspack-config-setup",bundlePath:"",filename:""},components:{App:c.default,Document:a.default},userland:p});o()}catch(e){o(e)}})},62993:(e,t,r)=>{function o(e,t){if(void 0!==t.title)return t.title;let r=e.split("/"),o=r[r.length-1],n=r[r.length-2],s=r[r.length-3];return["properties","definitions"].includes(n)?o:"additionalProperties"===o?"(Additional properties)":"items"===o&&["properties","definitions"].includes(s)?n+" items":void 0}function n(e){return"boolean"==typeof e?e?"Anything is allowed here.":"There is no valid value for this property.":0===Object.keys(e).length?"Anything is allowed here.":e.description??"No description available."}r.d(t,{cR:()=>c,r1:()=>u,LS:()=>n,p$:()=>i,ir:()=>a,A:()=>o,wY:()=>p});var s=r(60131);function i(e,t){return a(t.getSchema({$ref:e}))}function a(e){return void 0===e?void 0:e.schema}class c{constructor(e){this.schema=e}getSchema(e){if(void 0===e)return;if("boolean"==typeof e||void 0===e.$ref)return{schema:e};let t=e.$ref;if(!t.startsWith("#")){console.error("[SCHEMA] The schema appears to have non-internal references which is not supported:",t);return}let r=(0,s.get)(this.schema,t.slice(1));if(void 0===r)return;let o=this.getSchema(r);if(void 0!==o)return{schema:o.schema,baseReference:o.baseReference??t}}}function p(e,t){let r=["nx","workspace","devkit","nx-plugin"];function o(e,t){if(!(e in t))throw Error(`Property '${e.toString()}' can not be found in passed object.`);return!0}return[...r.map(r=>e.find(e=>o(t,e)&&e[t]===r)),...e.filter(e=>o(t,e)&&!r.includes(String(e[t])))].filter(e=>!!e)}function u(e){let t=["create-nx-workspace","create-nx-plugin","tao"];return e.filter(e=>!t.includes(e.name))}},60282:(e,t,r)=>{r.d(t,{k:()=>o});let o=`
# Configure Rspack on your Nx workspace

You can configure Rspack using a \`rspack.config.js\` file in your project. You can set the path to this file in your \`project.json\` file, in the \`build\` target options:

\`\`\`json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/rspack:rspack",
            //...
            "options": {
                //...
                "rspackConfig": "apps/my-app/rspack.config.js"
            },
            "configurations": {
                ...
            }
        },
    }
}
\`\`\`

In that file, you can add the necessary configuration for Rspack. You can read more on how to configure Rspack in the [Rspack documentation](https://www.rspack.dev/).

### Basic configuration for Nx

You should start with a basic Rspack configuration for Nx in your project, that looks like this:

\`\`\`js {% fileName="apps/my-app/rspack.config.js" %}
const { composePlugins, withNx } = require('@nx/rspack');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // customize Rspack config here
  return config;
});
\`\`\`

The \`withNx()\` plugin adds the necessary configuration for Nx to work with Rspack. The \`composePlugins\` function allows you to add other plugins to the configuration.

#### The \`composePlugins\` function

The \`composePlugins\` function takes a list of plugins and a function, and returns a Rspack \`Configuration\` object. The \`composePlugins\` function is an enhanced version of the Rspack configuration function, which allows you to add plugins to the configuration, and provides you with a function which accepts two arguments:

1. \`config\`: The Rspack configuration object.
2. An object with the following properties:
   - \`options\`: The options passed to the \`@nx/rspack:rspack\` executor.
   - \`context\`: The context passed of the \`@nx/rspack:rspack\` executor.

This gives you the ability to customize the Rspack configuration as needed, and make use of the options and context passed to the executor, as well.

### Add configurations for other functionalities

In addition to the basic configuration, you can add configurations for other frameworks or features. The \`@nx/rspack\` package provides plugins such as \`withWeb\` and \`withReact\`. This plugins provide features such as TS support, CSS support, JSX support, etc. You can read more about how these plugins work and how to use them in our [Rspack Plugins guide](/nx-api/rspack/documents/rspack-plugins).

You may still reconfigure everything manually, without using the Nx plugins. However, these plugins ensure that you have the necessary configuration for Nx to work with your project.

## Customize your Rspack config

For most apps, the default configuration of Rspack is sufficient, but sometimes you need to tweak a setting in your Rspack config. This guide explains how to make a small change without taking on the maintenance burden of the entire Rspack config.

### Configure Rspack for React projects

React projects use the \`withReact\` plugin that adds the necessary configuration for React to work with Rspack. You can use this plugin to add the necessary configuration to your Rspack config.

\`\`\`js {% fileName="apps/my-app/rspack.config.js" %}
const { composePlugins, withNx, withReact } = require('@nx/rspack');

// Nx plugins for Rspack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config, { options, context }) => {
    // Update the Rspack config as needed here.
    // e.g. config.plugins.push(new MyPlugin())
    return config;
  }
);
\`\`\`

`},80291:(e,t,r)=>{r.d(t,{K:()=>o});let o={description:"",documents:{"/nx-api/rspack/documents/overview":{id:"overview",name:"Overview of the Nx Rspack plugin",description:"The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/overview",tags:[]},"/nx-api/rspack/documents/rspack-plugins":{id:"rspack-plugins",name:"Rspack plugins",description:"Rspack plugins",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-plugins",tags:[]},"/nx-api/rspack/documents/rspack-config-setup":{id:"rspack-config-setup",name:" How to configure Rspack on your Nx workspace",description:"A guide on how to configure rspack on your Nx workspace, and instructions on how to customize your rspack configuration.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-config-setup",tags:[]}},executors:{"/nx-api/rspack/executors/rspack":{description:"Run rspack build.",file:"generated/packages/rspack/executors/rspack.json",hidden:!1,name:"rspack",originalFilePath:"/nx-api/rspack/src/executors/rspack/schema.json",path:"/nx-api/rspack/executors/rspack",type:"executor"},"/nx-api/rspack/executors/dev-server":{description:"Serve a web application.",file:"generated/packages/rspack/executors/dev-server.json",hidden:!1,name:"dev-server",originalFilePath:"/nx-api/rspack/src/executors/dev-server/schema.json",path:"/nx-api/rspack/executors/dev-server",type:"executor"}},generators:{"/nx-api/rspack/generators/init":{description:"Initialize the `@nx/rspack` plugin.",file:"generated/packages/rspack/generators/init.json",hidden:!1,name:"init",originalFilePath:"/nx-api/rspack/src/generators/init/schema.json",path:"/nx-api/rspack/generators/init",type:"generator"},"/nx-api/rspack/generators/configuration":{description:"Add Rspack configuration to a project.",file:"generated/packages/rspack/generators/configuration.json",hidden:!1,name:"configuration",originalFilePath:"/nx-api/rspack/src/generators/configuration/schema.json",path:"/nx-api/rspack/generators/configuration",type:"generator"},"/nx-api/rspack/generators/application":{description:"Add Rspack application to a project.",file:"generated/packages/rspack/generators/application.json",hidden:!1,name:"application",originalFilePath:"/nx-api/rspack/src/generators/application/schema.json",path:"/nx-api/rspack/generators/application",type:"generator"}},githubRoot:"https://github.com/nrwl/nx-labs/tree/main/packages/rspack",name:"rspack",packageName:"@nx/rspack",path:"",root:"",source:""}},21619:(e,t,r)=>{r.a(e,async(e,o)=>{try{r.r(t),r.d(t,{default:()=>x,getStaticProps:()=>k});var n=r(20997),s=r(48928),i=r(62993),a=r(30444),c=r(65628),p=r(95369),u=r(3553),l=r(60282),g=r(80291),d=r(41068),h=r(26386),f=e([a,c]);function x({document:e,menu:t,relatedDocuments:r,widgetData:o}){let{toggleNav:p,navIsOpen:l}=(0,u.s)(),g={document:e,menu:{sections:(0,i.wY)((0,s.OP)(t),"id")},relatedDocuments:r};return(0,n.jsxs)("div",{id:"shell",className:"flex h-full flex-col",children:[n.jsx("div",{className:"w-full flex-shrink-0",children:n.jsx(c.aV,{isNavOpen:l,toggleNav:p})}),(0,n.jsxs)("main",{id:"main",role:"main",className:"flex h-full flex-1 overflow-y-hidden",children:[n.jsx(c._G,{menu:g.menu,navIsOpen:l,toggleNav:p}),n.jsx(h.t,{resetScrollOnNavigation:!0,children:n.jsx(a.z,{document:g.document,relatedDocuments:g.relatedDocuments,widgetData:o})})]})]})}async function k(){let e={content:l.k,description:"A guide on how to configure Rspack on your Nx workspace, and instructions on how to customize your Rspack configuration.",filePath:"",id:"rspack-plugins",name:" How to configure Rspack on your Nx workspace",relatedDocuments:{},tags:[]};return{props:{pkg:g.K,document:e,widgetData:{githubStarsCount:await (0,d.P)()},relatedDocuments:[],menu:p.m.getMenu("nx-api","")}}}[a,c]=f.then?(await f)():f,o()}catch(e){o(e)}})},26386:(e,t,r)=>{r.d(t,{t:()=>a});var o=r(20997),n=r(16689),s=r(5632),i=r(62661);function a(e){let t=(0,n.useRef)(null),r=(0,s.useRouter)(),a=(0,n.useRef)(0),c=(0,n.useRef)(!0);return o.jsx("div",{ref:t,id:"wrapper","data-testid":"wrapper",className:"relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll",onScroll:e=>{var t;if(!c.current)return;let{scrollHeight:o,scrollTop:n,offsetHeight:s}=e.currentTarget,p=(t=(n+s)/o)>=.9?90:t<.25?0:t<.5?25:t<.75?50:75;p>a.current&&(a.current=p,(0,i.K)(`scroll_${p}`,"scroll",r.asPath))},children:e.children})}},68781:e=>{e.exports=require("@docsearch/react")},45360:e=>{e.exports=require("@markdoc/markdoc")},5411:e=>{e.exports=require("@nx/graph/shared")},34928:e=>{e.exports=require("@nx/graph/ui-components")},80760:e=>{e.exports=require("@nx/graph/ui-graph")},35864:e=>{e.exports=require("@nx/graph/ui-icons")},68994:e=>{e.exports=require("@nx/graph/ui-tooltips")},59003:e=>{e.exports=require("classnames")},60131:e=>{e.exports=require("jsonpointer")},16641:e=>{e.exports=require("next-seo")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},62785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},40968:e=>{e.exports=require("next/head")},84287:e=>{e.exports=require("octokit")},16689:e=>{e.exports=require("react")},42807:e=>{e.exports=require("react-copy-to-clipboard")},66405:e=>{e.exports=require("react-dom")},90727:e=>{e.exports=require("react-syntax-highlighter")},20997:e=>{e.exports=require("react/jsx-runtime")},90748:e=>{e.exports=import("@zkochan/js-yaml")},66197:e=>{e.exports=import("framer-motion")},68097:e=>{e.exports=import("tailwind-merge")},57147:e=>{e.exports=require("fs")},71017:e=>{e.exports=require("path")},12781:e=>{e.exports=require("stream")},59796:e=>{e.exports=require("zlib")}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),o=t.X(0,[2546,413,331,4343,324,4880,8799,6641],()=>r(69487));module.exports=o})();