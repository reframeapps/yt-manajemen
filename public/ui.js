// Small, local icon set: no external fonts, scripts, or requests.
const HUB_ICONS = {
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-1.5v-3L20 9l-2-3-2 .5-2-1-.5-2Z"/>',
  pin:'<path d="m9 3 6 0-1 6 4 4v2h-5v6m-2-6H6v-2l4-4Z"/>',
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2m4 0h2M8 18h2"/>',
  board:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M6 8v5m6-5v8m6-8v3"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
  chart:'<path d="M4 3v17h17M8 16v-4m5 4V8m5 8V5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
  move:'<path d="M4 12h16m-5-5 5 5-5 5M4 5v14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  text:'<path d="M5 5h14M5 10h14M5 15h10M5 20h7"/>',
  paperclip:'<path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2m3 7-8 8a1 1 0 0 1-2-2l8-8"/>',
  logout:'<path d="M9 4H4v16h5m7-13 5 5-5 5M8 12h13"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  trash:'<path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6"/>',
  youtube:'<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
  tiktok:'<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>',
  instagram:'<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  facebook:'<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  twitter:'<path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768m2.464-2.464L20 4"/>',
  threads:'<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098c1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015c-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164c1.43 1.783 3.631 2.698 6.54 2.717c2.623-.02 4.358-.631 5.8-2.045c1.647-1.613 1.618-3.593 1.09-4.798c-.31-.71-.873-1.3-1.634-1.75c-.192 1.352-.622 2.446-1.284 3.272c-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801c-1.063-.689-1.685-1.74-1.752-2.964c-.065-1.19.408-2.285 1.33-3.082c.88-.76 2.119-1.207 3.583-1.291a14 14 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757c-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.18c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388q.163.07.321.142c1.49.7 2.58 1.761 3.154 3.07c.797 1.82.871 4.79-1.548 7.158c-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69q-.362 0-.739.021c-1.836.103-2.98.946-2.916 2.143c.067 1.256 1.452 1.839 2.784 1.767c1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z"/>'
};
function hubIcon(name, className=''){
  const isFilled=['tiktok','threads','youtube'].includes(name);
  return `<svg class="hub-icon ${className}" viewBox="0 0 24 24" fill="${isFilled?'currentColor':'none'}" ${isFilled?'stroke="none"':'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${HUB_ICONS[name]||HUB_ICONS.text}</svg>`;
}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=hubIcon(el.dataset.icon));
let navigationReturnFocus=null;
function setNavigation(open){
  if(open)navigationReturnFocus=document.activeElement;
  document.body.classList.toggle('navigation-open',open);
  syncNavigation();
  $('#navBackdrop').classList.toggle('hide',!open);
  $('#menuToggle').setAttribute('aria-expanded',String(open));
  $('#menuToggle').setAttribute('aria-label',open?'Tutup navigasi':'Buka navigasi');
  if(open)$('#closeNavigation').focus();
  else if(navigationReturnFocus){navigationReturnFocus.focus();navigationReturnFocus=null}
}
$('#menuToggle').onclick=()=>setNavigation(!document.body.classList.contains('navigation-open'));
$('#closeNavigation').onclick=()=>setNavigation(false);
$('#navBackdrop').onclick=()=>setNavigation(false);
document.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('navigation-open'))return;
  if(e.key==='Escape'){e.preventDefault();setNavigation(false)}
  if(e.key==='Tab'){
    const buttons=[...$('#mainNavigation').querySelectorAll('button')].filter(el=>el.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
});
const mobileNavigation=matchMedia('(max-width: 900px)');
function syncNavigation(){
  const hidden=mobileNavigation.matches&&!document.body.classList.contains('navigation-open');
  $('#mainNavigation').inert=hidden;
  $('#mainNavigation').setAttribute('aria-hidden',String(hidden));
  if(!mobileNavigation.matches&&document.body.classList.contains('navigation-open'))setNavigation(false);
}
new MutationObserver(syncNavigation).observe(document.body,{attributes:true,attributeFilter:['class']});
mobileNavigation.addEventListener('change',syncNavigation);
syncNavigation();
window.updateWorkspaceChrome=function(view,title){
  $('#contentHub').dataset.view=view;
  $('#currentViewName').textContent=title;
  const channel=state.server?.channel;
  $('#workspaceChannel').textContent=channel?.title||'YouTube belum terhubung';
  $('#workspaceDot').classList.toggle('on',!!state.server?.youtubeConnected);
  document.querySelectorAll('.hub-nav [data-view]').forEach(el=>el.setAttribute('aria-current',el.dataset.view===view?'page':'false'));
};
