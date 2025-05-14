/**
 * GENERATED FILE - DO NOT EDIT
 * This JS module code was built from the source file "js-module.ts".
 * To change it, modify the source file and then re-run the build script.
 */

export default '(function(){async function i(n){const t=n.currentTarget,o=t.dataset,c=o.code?.replace(/\u007f/g,`\n`),u=o.filepath;if(t.dispatchEvent(new CustomEvent("tutorialkit:[BUTTON_NAME]",{detail:{code:c,filepath:u},bubbles:!0})),t.parentNode?.querySelector(".feedback"))return;let e=document.createElement("div");e.classList.add("feedback"),e.append(o.copied),t.before(e),e.offsetWidth,requestAnimationFrame(()=>e?.classList.add("show"));const a=()=>!e||e.classList.remove("show"),d=()=>{!e||parseFloat(getComputedStyle(e).opacity)>0||(e.remove(),e=void 0)};setTimeout(a,1500),setTimeout(d,2500),t.addEventListener("blur",a),e.addEventListener("transitioncancel",d),e.addEventListener("transitionend",d)}const r="[SELECTOR]";function s(n){n.querySelectorAll?.(r).forEach(t=>t.addEventListener("click",i))}s(document),new MutationObserver(n=>n.forEach(t=>t.addedNodes.forEach(o=>{s(o)}))).observe(document.body,{childList:!0,subtree:!0}),document.addEventListener("astro:page-load",()=>{s(document)})})();\n';
