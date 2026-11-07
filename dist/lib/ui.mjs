const paths={
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 external:'<path d="M14 4h6v6m0-6L10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
 grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
 dice:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="3"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 edit:'<path d="m15 4 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16Z"/>',
 folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
 upload:'<path d="M12 15V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
 back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 7M4 12l2 7a7 7 0 0 0 12-2"/>',
 fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 book:'<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/>'
};
export function icon(name){const span=document.createElement('span');span.className='icon';span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.grid}</svg>`;return span;}
export function decorateIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.append(icon(el.dataset.icon)));}
export function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
export function notify(message){const target=document.querySelector('#toast');target.textContent=message;target.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>target.classList.remove('show'),6000);}
export function showDialog(dialog){dialog.returnFocus=document.activeElement;dialog.showModal();}
export function wireDialogs(){document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
 dialog.addEventListener('close',()=>dialog.returnFocus?.focus());
});}
export function downloadJSON(data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`교실도구함-백업-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
