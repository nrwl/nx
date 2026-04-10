"use strict";(()=>{var e={};e.id=7552,e.ids=[7552],e.modules={42581:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{config:()=>h,default:()=>l,getServerSideProps:()=>d,getStaticPaths:()=>x,getStaticProps:()=>g,reportWebVitals:()=>k,routeModule:()=>b,unstable_getServerProps:()=>v,unstable_getServerSideProps:()=>w,unstable_getStaticParams:()=>y,unstable_getStaticPaths:()=>f,unstable_getStaticProps:()=>m});var s=t(18877),n=t(84591),i=t(6021),o=t(51826),p=t(44998),c=t(86774),u=e([c]);c=(u.then?(await u)():u)[0];let l=(0,i.l)(c,"default"),g=(0,i.l)(c,"getStaticProps"),x=(0,i.l)(c,"getStaticPaths"),d=(0,i.l)(c,"getServerSideProps"),h=(0,i.l)(c,"config"),k=(0,i.l)(c,"reportWebVitals"),m=(0,i.l)(c,"unstable_getStaticProps"),f=(0,i.l)(c,"unstable_getStaticPaths"),y=(0,i.l)(c,"unstable_getStaticParams"),v=(0,i.l)(c,"unstable_getServerProps"),w=(0,i.l)(c,"unstable_getServerSideProps"),b=new s.PagesRouteModule({definition:{kind:n.x.PAGES,page:"/nx-api/rspack",pathname:"/nx-api/rspack",bundlePath:"",filename:""},components:{App:p.default,Document:o.default},userland:c});r()}catch(e){r(e)}})},98506:(e,a,t)=>{t.d(a,{k:()=>r});let r=`
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
`},80291:(e,a,t)=>{t.d(a,{K:()=>r});let r={description:"",documents:{"/nx-api/rspack/documents/overview":{id:"overview",name:"Overview of the Nx Rspack plugin",description:"The Nx Plugin for Rspack contains executors and generators that support building applications using Rspack.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/overview",tags:[]},"/nx-api/rspack/documents/rspack-plugins":{id:"rspack-plugins",name:"Rspack plugins",description:"Rspack plugins",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-plugins",tags:[]},"/nx-api/rspack/documents/rspack-config-setup":{id:"rspack-config-setup",name:" How to configure Rspack on your Nx workspace",description:"A guide on how to configure rspack on your Nx workspace, and instructions on how to customize your rspack configuration.",file:"",itemList:[],isExternal:!1,path:"/nx-api/rspack/documents/rspack-config-setup",tags:[]}},executors:{"/nx-api/rspack/executors/rspack":{description:"Run rspack build.",file:"generated/packages/rspack/executors/rspack.json",hidden:!1,name:"rspack",originalFilePath:"/nx-api/rspack/src/executors/rspack/schema.json",path:"/nx-api/rspack/executors/rspack",type:"executor"},"/nx-api/rspack/executors/dev-server":{description:"Serve a web application.",file:"generated/packages/rspack/executors/dev-server.json",hidden:!1,name:"dev-server",originalFilePath:"/nx-api/rspack/src/executors/dev-server/schema.json",path:"/nx-api/rspack/executors/dev-server",type:"executor"}},generators:{"/nx-api/rspack/generators/init":{description:"Initialize the `@nx/rspack` plugin.",file:"generated/packages/rspack/generators/init.json",hidden:!1,name:"init",originalFilePath:"/nx-api/rspack/src/generators/init/schema.json",path:"/nx-api/rspack/generators/init",type:"generator"},"/nx-api/rspack/generators/configuration":{description:"Add Rspack configuration to a project.",file:"generated/packages/rspack/generators/configuration.json",hidden:!1,name:"configuration",originalFilePath:"/nx-api/rspack/src/generators/configuration/schema.json",path:"/nx-api/rspack/generators/configuration",type:"generator"},"/nx-api/rspack/generators/application":{description:"Add Rspack application to a project.",file:"generated/packages/rspack/generators/application.json",hidden:!1,name:"application",originalFilePath:"/nx-api/rspack/src/generators/application/schema.json",path:"/nx-api/rspack/generators/application",type:"generator"}},githubRoot:"https://github.com/nrwl/nx-labs/tree/main/packages/rspack",name:"rspack",packageName:"@nx/rspack",path:"",root:"",source:""}},86774:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{default:()=>h,getStaticProps:()=>k});var s=t(20997),n=t(46871),i=t(48928),o=t(62993),p=t(65628),c=t(95369),u=t(3553),l=t(98506),g=t(80291),x=t(26386),d=e([n,p]);function h({overview:e,menu:a,pkg:t}){let{toggleNav:r,navIsOpen:c}=(0,u.s)(),l={menu:{sections:(0,o.wY)((0,i.OP)(a),"id")},package:t};return(0,s.jsxs)("div",{id:"shell",className:"flex h-full flex-col",children:[s.jsx("div",{className:"w-full flex-shrink-0",children:s.jsx(p.aV,{isNavOpen:c,toggleNav:r})}),(0,s.jsxs)("main",{id:"main",role:"main",className:"flex h-full flex-1 overflow-y-hidden",children:[s.jsx(p._G,{menu:l.menu,navIsOpen:c,toggleNav:r}),s.jsx(x.t,{resetScrollOnNavigation:!0,children:s.jsx(n.He,{pkg:l.package,overview:e})})]})]})}async function k(){return{props:{menu:c.m.getMenu("nx-api","nx-api"),overview:l.k,pkg:g.K}}}[n,p]=d.then?(await d)():d,r()}catch(e){r(e)}})},26386:(e,a,t)=>{t.d(a,{t:()=>o});var r=t(20997),s=t(16689),n=t(5632),i=t(62661);function o(e){let a=(0,s.useRef)(null),t=(0,n.useRouter)(),o=(0,s.useRef)(0),p=(0,s.useRef)(!0);return r.jsx("div",{ref:a,id:"wrapper","data-testid":"wrapper",className:"relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll",onScroll:e=>{var a;if(!p.current)return;let{scrollHeight:r,scrollTop:s,offsetHeight:n}=e.currentTarget,c=(a=(s+n)/r)>=.9?90:a<.25?0:a<.5?25:a<.75?50:75;c>o.current&&(o.current=c,(0,i.K)(`scroll_${c}`,"scroll",t.asPath))},children:e.children})}},68781:e=>{e.exports=require("@docsearch/react")},45360:e=>{e.exports=require("@markdoc/markdoc")},12587:e=>{e.exports=require("@monaco-editor/react")},5411:e=>{e.exports=require("@nx/graph/shared")},34928:e=>{e.exports=require("@nx/graph/ui-components")},80760:e=>{e.exports=require("@nx/graph/ui-graph")},35864:e=>{e.exports=require("@nx/graph/ui-icons")},68994:e=>{e.exports=require("@nx/graph/ui-tooltips")},59003:e=>{e.exports=require("classnames")},60131:e=>{e.exports=require("jsonpointer")},16641:e=>{e.exports=require("next-seo")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},62785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},40968:e=>{e.exports=require("next/head")},16689:e=>{e.exports=require("react")},42807:e=>{e.exports=require("react-copy-to-clipboard")},66405:e=>{e.exports=require("react-dom")},90727:e=>{e.exports=require("react-syntax-highlighter")},20997:e=>{e.exports=require("react/jsx-runtime")},90748:e=>{e.exports=import("@zkochan/js-yaml")},66197:e=>{e.exports=import("framer-motion")},68097:e=>{e.exports=import("tailwind-merge")},57147:e=>{e.exports=require("fs")},71017:e=>{e.exports=require("path")},12781:e=>{e.exports=require("stream")},59796:e=>{e.exports=require("zlib")}};var a=require("../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2546,413,331,4343,324,4880,8799,6871],()=>t(42581));module.exports=r})();