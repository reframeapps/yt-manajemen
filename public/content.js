let STAGE_NAMES = { idea:'Ide', script:'Naskah', production:'Produksi', editing:'Editing', review:'Review', ready:'Siap Upload' };
const FORMAT_NAMES = { shorts:'Short', long:'Long', live:'Live', other:'Lainnya' };
const CHECK_NAMES = { script:'Script selesai', video:'Video final siap', thumbnail:'Thumbnail siap', review:'Review selesai' };
const hub = { view:'dashboard', data:{contents:[],pillars:[]}, date:new Date(), mode:innerWidth<620?'agenda':'month', calendarField:'publish', editing:null, loading:false, loaded:false, timer:null, boardFilters:false, composer:null, columnMenu:null, boardSignature:null, moveCard:null, dragging:false, selected:new Set() };
const hubForm = $('#contentForm');
const richContentFields=['brief','script','productionNotes','description'];
for(const key of richContentFields)HubRichText.attach(hubForm.elements.namedItem(key));
const storyboardEditor=HubStoryboard.attach(formValue('productionNotes'),$('#storyboardSheet'),{notify:toast,changed:markDirty});
const wibParts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
function dayKey(value=Date.now()){const p=wibParts(value);return `${p.year}-${p.month}-${p.day}`}
function wibInput(value){if(!value)return '';const p=wibParts(value);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}
function inputIso(value){return value?new Date(value+':00+07:00').toISOString():null}
function dateWib(value){return value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}):'Belum dijadwalkan'}
function timeWib(value){return new Date(value).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}
function calendarDate(value){return new Date(value+'T00:00:00Z')}
function shiftDay(date,amount){const next=new Date(date);next.setUTCDate(next.getUTCDate()+amount);return next}
function keyUTC(date){return date.toISOString().slice(0,10)}
hub.date=calendarDate(dayKey());
function pillar(c){return hub.data.pillars.find(p=>p.id===c.pillarId)}
function pillarTag(c){const p=pillar(c);return `<span class="pillar-tag" style="--pillar:${p?.color||'#a9b2c1'}">${esc(p?.name||'Tanpa pilar')}</span>`}
function linkedJob(c){return state.server?.jobs?.find(j=>j.contentId===c.id&&j.status!=='cancelled')}
function activeJob(c){const j=linkedJob(c);return j&&!['failed','cancelled'].includes(j.status)?j:null}
function publicationState(c){const p=c.youtubePublication;if(c.youtubeVideoId&&p?.videoId===c.youtubeVideoId&&p.status)return p.status;const j=linkedJob(c);return j?.status||(c.youtubeVideoId?'linked_youtube':'not_uploaded')}
function publication(c){return PUBLICATION_STATUS[publicationState(c)]?.label||statusLabel(publicationState(c))}
function formatBadge(format){const value=Object.hasOwn(FORMAT_NAMES,format)?format:'unset';return `<span class="video-format video-format-${value}" title="Kategori video: ${FORMAT_NAMES[value]||'Belum dipilih'}" aria-label="Kategori video: ${FORMAT_NAMES[value]||'Belum dipilih'}">${FORMAT_NAMES[value]||'Belum dipilih'}</span>`}
function productionBadge(c){return statusBadge('production',c.stage)}
function publicationBadge(c){return statusBadge('publication',publicationState(c))}
function contentStatusRow(c){return `<div class="content-status-row">${productionBadge(c)}${publicationBadge(c)}</div>`}
function eventDate(c){const p=c.youtubeVideoId&&c.youtubePublication?.videoId===c.youtubeVideoId?c.youtubePublication:null;return hub.calendarField==='deadline'?c.deadline:(p?.publishedAt||p?.scheduledAt||activeJob(c)?.scheduledAt||c.plannedPublishAt)}
function isDateToday(iso){if(!iso)return false;return dayKey(iso)===dayKey()}
function contentAlertStatus(c){
  if(c.archived||(typeof isDoneStage==='function'&&isDoneStage(c.stage)))return null;
  const targetDate=c.deadline||c.plannedPublishAt;
  if(!targetDate)return null;
  const targetTime=Date.parse(targetDate);
  if(isNaN(targetTime))return null;
  if(targetTime<Date.now())return 'overdue';
  if(isDateToday(targetDate))return 'today';
  return null;
}
function getAlertCounts(){
  let overdue=0,today=0;
  for(const c of (hub.data?.contents||[])){
    const s=contentAlertStatus(c);
    if(s==='overdue')overdue++;
    else if(s==='today')today++;
  }
  return {overdue,today,total:overdue+today};
}
function updateAlertBadges(){
  const counts=getAlertCounts();
  const alertBadgeWrap=$('#alertCountBadge');
  if(alertBadgeWrap)alertBadgeWrap.textContent=counts.total;
  for(const sel of ['button[data-view="kanban"]','button[data-view="library"]']){
    const btn=$(sel);
    if(!btn)continue;
    let b=btn.querySelector('.nav-alert-badge');
    if(counts.total>0){
      if(!b){b=document.createElement('span');b.className='nav-alert-badge';btn.appendChild(b);}
      b.textContent=counts.total;
      b.title=`${counts.overdue} lewat tenggat, ${counts.today} hari ini`;
    }else if(b){
      b.remove();
    }
  }
}
function renderBulkBar(){
  let bar=document.querySelector('.bulk-action-bar');
  if(!hub.selected?.size||!['library','kanban'].includes(hub.view)){
    if(bar)bar.remove();
    return;
  }
  if(!bar){
    bar=document.createElement('div');
    bar.className='bulk-action-bar';
    document.body.appendChild(bar);
  }
  const stages=Object.entries(STAGE_NAMES).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
  const pillars=(hub.data.pillars||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  bar.innerHTML=`<span class="bulk-count">${hub.selected.size} konten dipilih</span><select id="bulkStageSelect" aria-label="Pindahkan tahap"><option value="">Pindah tahap...</option>${stages}</select><select id="bulkPillarSelect" aria-label="Ubah pilar"><option value="">Ubah pilar...</option><option value="none">Tanpa pilar</option>${pillars}</select><button type="button" class="btn mini" id="bulkArchiveBtn">Arsipkan</button><button type="button" class="btn mini danger" id="bulkDeleteBtn">Hapus</button><button type="button" class="btn mini" id="bulkClearBtn">Batal</button>`;
  bar.querySelector('#bulkStageSelect').onchange=async e=>{
    const stage=e.target.value;if(!stage)return;
    const selectedIds=[...hub.selected];
    const prev=hub.data.contents.map(c=>({...c}));
    hub.data.contents.forEach(c=>{if(hub.selected.has(c.id)){c.stage=stage;c.updatedAt=new Date().toISOString();}});
    hub.selected.clear();saveHubCache();renderHub();toast('Memindahkan '+selectedIds.length+' konten...');
    try{
      await api('/api/contents/batch',{method:'POST',body:JSON.stringify({action:'move',ids:selectedIds,stage})});
      toast('Berhasil memindahkan tahap');saveHubCache();void loadHub();
    }catch(err){hub.data.contents=prev;saveHubCache();renderHub();toast('Gagal: '+err.message)}
  };
  bar.querySelector('#bulkPillarSelect').onchange=async e=>{
    const val=e.target.value;if(!val)return;
    const pillarId=val==='none'?'':val;
    const selectedIds=[...hub.selected];
    const prev=hub.data.contents.map(c=>({...c}));
    hub.data.contents.forEach(c=>{if(hub.selected.has(c.id)){c.pillarId=pillarId;c.updatedAt=new Date().toISOString();}});
    hub.selected.clear();saveHubCache();renderHub();toast('Mengubah pilar '+selectedIds.length+' konten...');
    try{
      await api('/api/contents/batch',{method:'POST',body:JSON.stringify({action:'pillar',ids:selectedIds,pillarId})});
      toast('Berhasil mengubah pilar');saveHubCache();void loadHub();
    }catch(err){hub.data.contents=prev;saveHubCache();renderHub();toast('Gagal: '+err.message)}
  };
  bar.querySelector('#bulkArchiveBtn').onclick=async()=>{
    const selectedIds=[...hub.selected];
    const prev=hub.data.contents.map(c=>({...c}));
    hub.data.contents.forEach(c=>{if(hub.selected.has(c.id)){c.archived=true;c.updatedAt=new Date().toISOString();}});
    hub.selected.clear();saveHubCache();renderHub();toast('Mengarsipkan '+selectedIds.length+' konten...');
    try{
      await api('/api/contents/batch',{method:'POST',body:JSON.stringify({action:'archive',ids:selectedIds,archived:true})});
      toast('Berhasil mengarsipkan konten terpilih');saveHubCache();void loadHub();
    }catch(err){hub.data.contents=prev;saveHubCache();renderHub();toast('Gagal: '+err.message)}
  };
  bar.querySelector('#bulkDeleteBtn').onclick=async()=>{
    if(!confirm(`Yakin ingin menghapus ${hub.selected.size} konten yang dipilih?`))return;
    const selectedIds=[...hub.selected];
    const prev=hub.data.contents.map(c=>({...c}));
    const delSet=new Set(selectedIds);
    hub.data.contents=hub.data.contents.filter(c=>!delSet.has(c.id));
    hub.selected.clear();saveHubCache();renderHub();toast('Menghapus '+selectedIds.length+' konten...');
    try{
      await api('/api/contents/batch',{method:'POST',body:JSON.stringify({action:'delete',ids:selectedIds})});
      toast('Berhasil menghapus konten terpilih');saveHubCache();void loadHub();
    }catch(err){hub.data.contents=prev;saveHubCache();renderHub();toast('Gagal: '+err.message)}
  };
  bar.querySelector('#bulkClearBtn').onclick=()=>{hub.selected.clear();renderHub()};
}
const HUB_CACHE_KEY='yt-hub-cached-data';
function saveHubCache(){
  try{if(hub.data?.contents&&hub.data?.pillars)sessionStorage.setItem(HUB_CACHE_KEY,JSON.stringify(hub.data))}catch{}
}
function restoreHubCache(){
  try{
    const raw=sessionStorage.getItem(HUB_CACHE_KEY);
    if(!raw)return false;
    const parsed=JSON.parse(raw);
    if(parsed&&Array.isArray(parsed.contents)&&Array.isArray(parsed.pillars)){
      hub.data=parsed;
      if(typeof syncBoardColumns==='function')syncBoardColumns(hub.data);
      hub.loaded=true;
      updateAlertBadges();
      updateFilters();
      renderHub();
      return true;
    }
  }catch{}
  return false;
}
function filtered(){const q=$('#contentSearch').value.toLocaleLowerCase('id-ID').trim(),p=$('#pillarFilter').value,s=$('#stageFilter').value,f=$('#formatFilter').value,arch=$('#archiveFilter').checked,alertOnly=$('#alertFilter')?.checked;return hub.data.contents.filter(c=>{if(c.archived!==arch)return false;if(alertOnly&&!contentAlertStatus(c))return false;if(q&&!(c.title+' '+(c.owner||'')).toLocaleLowerCase('id-ID').includes(q))return false;if(p&&c.pillarId!==p)return false;if(s&&c.stage!==s)return false;if(f&&c.format!==f)return false;return true;})}
function options(values,selected=''){return values.map(([v,label])=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(label)}</option>`).join('')}
function updateFilters(){const p=$('#pillarFilter'),s=$('#stageFilter');p.innerHTML=options([['','Semua pilar'],...hub.data.pillars.map(p=>[p.id,p.name])],p.value);s.innerHTML=options([['','Semua tahap'],...Object.entries(STAGE_NAMES)],s.value)}
async function loadHub(force=false){
  if(hub.loading)return hub.loadTask;
  hub.loading=true;
  hub.loadTask=(async()=>{try{
    const fresh=await api('/api/contents');
    const changed=!hub.loaded||JSON.stringify(fresh.contents)!==JSON.stringify(hub.data?.contents)||JSON.stringify(fresh.pillars)!==JSON.stringify(hub.data?.pillars);
    hub.data=fresh;
    saveHubCache();
    syncBoardColumns(hub.data);
    hub.loaded=true;
    updateAlertBadges();
    $('#hubError').classList.add('hide');
    if(changed||force){updateFilters();renderHub();showDraftBanner();}
    void reconcileLocalDrafts();
  }catch(e){$('#hubError').classList.remove('hide');$('#hubError').textContent='Gagal memuat konten: '+e.message}})();
  try{return await hub.loadTask}finally{hub.loading=false;hub.loadTask=null}
}
function contentSummary(c){const fields=['id','title','stage','pillarId','format','priority','owner','deadline','plannedPublishAt','checklist','archived','revision','createdAt','updatedAt','youtubeVideoId','youtubePublication'];return {...Object.fromEntries(fields.map(key=>[key,c[key]])),scriptLength:c.script.length}}
window.onHubState=()=>{showDraftBanner();if(hub.editing)renderEditorMeta();loadHub()};
const draftChecks=new Map();
const draftDismissedSession=new Map();
let draftCheckBusy=false;
function validLocalDraft(d){return !!d&&typeof d==='object'&&typeof d.id==='string'&&/^[a-z0-9-]{1,100}$/i.test(d.id)&&d.fields&&typeof d.fields==='object'&&!Array.isArray(d.fields);}
function draftHasContent(fields){return ['title','owner','audience','brief','hook','cta','productionNotes','script','description','tags','deadline','plannedPublishAt'].some(k=>typeof fields[k]==='string'&&fields[k].trim())||['sources','assets'].some(k=>Array.isArray(fields[k])&&fields[k].some(row=>row&&['label','url','notes'].some(key=>typeof row[key]==='string'&&row[key].trim())))||!!fields.publicationLinks?.length||Object.values(fields.checklist||{}).some(v=>v===true);}
function localDrafts(){
 const drafts=new Map();let keys=[];try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key==='yt-hub-pending'||key?.startsWith('yt-hub-draft-'))keys.push(key);}}catch{return [];}
 for(const key of keys)try{const d=JSON.parse(localStorage.getItem(key)||'null');if(!validLocalDraft(d)||(d.isNew&&!draftHasContent(d.fields)))continue;const old=drafts.get(d.id);if(!old||Number(d.at||0)>Number(old.at||0)||Number(d.at||0)===Number(old.at||0)&&key!=='yt-hub-pending')drafts.set(d.id,d);}catch{}
 return [...drafts.values()].sort((a,b)=>Number(b.at||0)-Number(a.at||0));
}
function storedDraft(id){return localDrafts().find(d=>!id||d.id===id)||null;}
function draftStamp(d){return JSON.stringify([d.id,d.at,d.revision,d.epoch,d.fields]);}
function dismissedDrafts(){try{const value=JSON.parse(localStorage.getItem('yt-hub-draft-dismissed')||'{}');return {...(value&&typeof value==='object'&&!Array.isArray(value)?value:{}),...Object.fromEntries(draftDismissedSession)};}catch{return Object.fromEntries(draftDismissedSession);}}
function dismissalKey(d){return JSON.stringify([d.at,d.revision,d.epoch]);}
function clearLocalDraft(id){draftDismissedSession.delete(id);try{localStorage.removeItem('yt-hub-draft-'+id);const pending=JSON.parse(localStorage.getItem('yt-hub-pending')||'null');if(pending?.id===id)localStorage.removeItem('yt-hub-pending');const dismissed=dismissedDrafts();delete dismissed[id];localStorage.setItem('yt-hub-draft-dismissed',JSON.stringify(dismissed));draftChecks.delete(id);}catch{}}
function sameDraftFields(fields,content){
 const stable=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])):Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):value);
 try{return Object.keys(fields).length>0&&Object.entries(fields).every(([key,value])=>Object.hasOwn(content,key)&&stable(value)===stable(content[key]));}catch{return false;}
}
async function reconcileLocalDrafts(){
 if(draftCheckBusy||!hub.loaded)return;draftCheckBusy=true;
 try{for(const d of localDrafts().filter(d=>!d.isNew).slice(0,20)){
  if(hub.editing?.content.id===d.id)continue;
  const summary=hub.data.contents.find(c=>c.id===d.id);if(!summary)continue;
  const stamp=draftStamp(d),check=stamp+'|'+summary.revision;if(draftChecks.get(d.id)===check)continue;
  try{const {content}=await api('/api/contents/'+encodeURIComponent(d.id));const current=storedDraft(d.id);if(!current||draftStamp(current)!==stamp||hub.editing?.content.id===d.id)continue;
   if(sameDraftFields(d.fields,content))clearLocalDraft(d.id);else draftChecks.set(d.id,stamp+'|'+content.revision);
  }catch{} // Network failure keeps recovery data and allows a later retry.
 }}finally{draftCheckBusy=false;showDraftBanner();}
}
function showDraftBanner(){
 const dismissed=dismissedDrafts(),drafts=localDrafts().filter(d=>dismissed[d.id]!==dismissalKey(d)),draft=drafts[0],box=$('#draftBanner');
 box.classList.toggle('hide',!draft||!!hub.editing);if(!draft)return;
 $('#draftBannerText').textContent=(drafts.length>1?drafts.length+' draft lokal belum tersimpan. Terbaru: ':'Draft lokal belum tersimpan: ')+(typeof draft.fields.title==='string'&&draft.fields.title.trim()?draft.fields.title.trim():'Konten tanpa judul');
 $('#recoverDraft').onclick=async()=>{try{await openContent(draft.id);}catch(e){if(e.status===404||/tidak ditemukan/i.test(e.message)){await newContent(draft.fields,draft.id);}else toast(e.message);}};
 $('#dismissDraft').onclick=()=>{for(const d of drafts)draftDismissedSession.set(d.id,dismissalKey(d));try{const values=dismissedDrafts();for(const d of drafts)values[d.id]=dismissalKey(d);localStorage.setItem('yt-hub-draft-dismissed',JSON.stringify(Object.fromEntries(Object.entries(values).slice(-100))));}catch{}box.classList.add('hide');toast('Pemberitahuan ditutup. Draft tetap dapat dipulihkan lewat Draft lokal.');};
 $('#discardDraft').onclick=()=>{const current=storedDraft(draft.id);if(!current||draftStamp(current)!==draftStamp(draft)){showDraftBanner();return;}if(!confirm('Hapus draft lokal “'+(draft.fields.title||'Konten tanpa judul')+'”? Konten tersimpan di server tetap ada.'))return;const latest=storedDraft(draft.id);if(!latest||draftStamp(latest)!==draftStamp(draft)){showDraftBanner();toast('Draft berubah. Periksa versi terbaru sebelum menghapus.');return;}clearLocalDraft(draft.id);showDraftBanner();};
}
function openLocalDrafts(){const drafts=localDrafts();if(!drafts.length)return toast('Tidak ada draft lokal.');const dismissed=dismissedDrafts();for(const d of drafts){delete dismissed[d.id];draftDismissedSession.delete(d.id);}try{localStorage.setItem('yt-hub-draft-dismissed',JSON.stringify(dismissed));}catch{}showDraftBanner();$('#draftBanner').scrollIntoView({behavior:'smooth',block:'center'});}
$('#localDrafts').onclick=openLocalDrafts;
window.addEventListener('storage',e=>{if(e.key===null||e.key?.startsWith('yt-hub-')){showDraftBanner();void reconcileLocalDrafts();}});
function navigate(view){hub.view=view;setNavigation(false);document.querySelectorAll('.hub-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#contentHub').classList.toggle('hide',view==='upload');$('#uploadView').classList.toggle('hide',view!=='upload');renderHub()}
document.querySelector('.hub-nav').addEventListener('click',e=>{const button=e.target.closest('[data-view]');if(button)navigate(button.dataset.view)});
const VIEW_TEXT={preferences:['Pengaturan','Kelola koneksi, periksa status layanan, dan atur workspace.'],radar:['Radar Konten','Temukan isu, pantau channel, dan siapkan referensi produksi.'],updates:['Riwayat Update','Fitur baru dan perbaikan pada setiap versi aplikasi.'],storage:['Data & Backup','Penyimpanan PostgreSQL dan salinan pemulihan data.'],dashboard:['Dashboard','Pantau rencana, progres produksi, dan publikasi.'],calendar:['Kalender Konten','Rencana produksi dan jadwal tayang dalam zona waktu WIB.'],kanban:['Kanban Produksi','Atur progres pekerjaan tanpa mengubah status publikasi.'],library:['Semua Konten','Temukan ide, script, dan bahan produksi dalam satu tempat.'],analytics:['YouTube Analytics','Analisis channel dan per video, dari jangkauan sampai pendapatan.'],notes:['Note','Simpan ide dan catatan dengan kategori pilihan Anda.'],settings:['Pilar Konten','Atur nama dan warna yang konsisten di semua tampilan.']};
function renderHub(){updateWorkspaceChrome(hub.view,VIEW_TEXT[hub.view]?.[0]||'Upload & Antrean');updateAlertBadges();if(!['library','kanban'].includes(hub.view))renderBulkBar();if(hub.view==='upload')return;const txt=VIEW_TEXT[hub.view];$('#viewTitle').textContent=txt[0];$('#viewSubtitle').textContent=txt[1];$('#hubFilters').classList.toggle('hide',!['calendar','kanban','library'].includes(hub.view));$('#newContent').classList.toggle('hide',['radar','analytics','kanban','notes','storage','updates','preferences'].includes(hub.view));$('#hubFilters').classList.toggle('filters-closed',hub.view==='kanban'&&!hub.boardFilters);const body=$('#hubBody');if(hub.view==='radar'){window.renderRadar(body);return}if(hub.view==='analytics'){window.renderAnalytics(body);return}if(hub.view==='notes'){window.renderNotes(body);return}if(hub.view==='storage'){window.renderStorage(body);return}if(hub.view==='updates'){window.renderUpdates(body);return}if(hub.view==='preferences'){window.renderPreferences(body);return}if(!hub.loaded){body.innerHTML='<div class="empty">Memuat konten…</div>';return}if(hub.view==='dashboard')renderDashboard(body);if(hub.view==='calendar')renderCalendar(body);if(hub.view==='kanban')renderKanban(body);if(hub.view==='library')renderLibrary(body);if(hub.view==='settings')renderSettings(body)}
for(const id of ['contentSearch','pillarFilter','stageFilter','formatFilter','archiveFilter','alertFilter'])$('#'+id)?.addEventListener(id==='contentSearch'?'input':'change',renderHub);
function card(c){const alertSt=contentAlertStatus(c),alertPill=alertSt==='overdue'?'<span class="alert-pill overdue">⚠️ Lewat Tenggat</span>':alertSt==='today'?'<span class="alert-pill today">🔔 Hari Ini</span>':'';return `<article class="content-card" draggable="true" data-card="${c.id}" tabindex="0" role="button" aria-label="Buka ${esc(c.title)}" style="--pillar:${pillar(c)?.color||'#d2d9e3'}"><div class="card-meta">${pillarTag(c)}${formatBadge(c.format)}${c.priority==='high'?'<span class="overdue">Prioritas tinggi</span>':''}${alertPill}</div><div class="card-title">${esc(c.title)}</div>${progressSummary(c)}<div class="card-meta"><span>${esc(c.owner||'Belum ditugaskan')}</span></div>${c.deadline?`<div class="card-meta ${new Date(c.deadline)<new Date()&&!isDoneStage(c.stage)?'overdue':''}" style="margin-top:7px">Deadline ${dateWib(c.deadline)}</div>`:''}<div class="card-meta" style="margin-top:7px">${productionBadge(c)}${publicationBadge(c)}${c.scriptLength?'<span>• Script tersedia</span>':''}</div></article>`}
function renderDashboard(body){const all=hub.data.contents.filter(c=>!c.archived),jobs=state.server?.jobs||[],counts=Object.keys(STAGE_NAMES).map(k=>all.filter(c=>c.stage===k).length),upcoming=all.filter(c=>activeJob(c)?.scheduledAt||c.plannedPublishAt).sort((a,b)=>Date.parse(activeJob(a)?.scheduledAt||a.plannedPublishAt)-Date.parse(activeJob(b)?.scheduledAt||b.plannedPublishAt)).filter(c=>Date.parse(activeJob(c)?.scheduledAt||c.plannedPublishAt)>=Date.now()).slice(0,5);const alerts=getAlertCounts();const alertBanner=alerts.total>0?`<div class="alert-dashboard-banner"><div><strong>🚨 Ada ${alerts.overdue} konten melewati tenggat dan ${alerts.today} konten dijadwalkan hari ini.</strong><div class="hint" style="color:inherit;margin-top:2px">Segera periksa dan selesaikan tahapan produksinya.</div></div><button type="button" class="btn mini primary" id="dashViewAlerts">Lihat Semua (${alerts.total})</button></div>`:'';const overdueItems=all.filter(c=>contentAlertStatus(c)==='overdue');const signature=JSON.stringify([all.length,counts,alerts.total,upcoming.map(c=>[c.id,c.plannedPublishAt]),jobs.map(j=>[j.id,j.status])]);if(hub.dashboardSignature===signature&&body.querySelector('.dash-grid'))return;hub.dashboardSignature=signature;body.innerHTML=`${alertBanner}<div class="stats-grid">${[[all.length,'Konten aktif'],[all.filter(c=>isDoneStage(c.stage)).length,'Produksi selesai'],[jobs.filter(j=>j.status==='scheduled_youtube').length,'Terjadwal YouTube'],[jobs.filter(j=>j.status==='published').length,'Sudah tayang']].map(([n,l],i)=>`<div class="stat-card"><div class="stat-top"><span>${esc(l)}</span><div class="stat-icon">${hubIcon(['folder','check','calendar','upload'][i])}</div></div><strong>${n}</strong><div class="stat-note">${['Ide & produksi dalam workspace','Selesai melalui proses produksi','Jadwal tersimpan di YouTube','Video berhasil dipublikasikan'][i]}</div></div>`).join('')}</div><div class="dash-grid"><div class="hub-panel"><h3>Jadwal terdekat</h3>${upcoming.length?upcoming.map(c=>`<div class="hint">${dateWib(activeJob(c)?.scheduledAt||c.plannedPublishAt)}</div>${card(c)}`).join(''):'<div class="empty">Mulai dengan ide baru, lalu tentukan target tayangnya.</div>'}</div><div class="hub-panel"><h3>Progres produksi</h3><div class="stage-bars">${Object.entries(STAGE_NAMES).map(([k,l],i)=>`<div><span>${esc(l)}</span><i><b style="width:${counts[i]/Math.max(all.length,1)*100}%"></b></i><span>${counts[i]}</span></div>`).join('')}</div><div class="subheading"><h3 style="margin-top:25px">Perlu perhatian</h3></div><p class="hint">${alerts.overdue} konten melewati deadline · ${alerts.today} hari ini · ${jobs.filter(j=>j.status==='failed').length} upload gagal</p>${overdueItems.slice(0,3).map(card).join('')}<button class="btn mini" data-go="upload">Lihat antrean YouTube</button></div></div><p class="hub-footer">Script dan bahan riset dapat disimpan tanpa video. Status produksi dan status publikasi dikelola terpisah.</p>`}
function kanbanCard(c){
  const p=pillar(c);
  const due=c.deadline?new Date(c.deadline):null,late=due&&due.getTime()<Date.now()&&!isDoneStage(c.stage);
  const date=due?due.toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'}):'';
  const initials=c.owner.trim().split(/\s+/).slice(0,2).map(v=>[...v][0]||'').join('').toUpperCase();
  const alertSt=contentAlertStatus(c);
  const alertBadge=alertSt==='overdue'?'<span class="card-badge overdue" title="Melewati tenggat!">⚠️ Lewat</span>':alertSt==='today'?'<span class="card-badge" style="background:#fef9c3;color:#854d0e;border:1px solid #fef08a" title="Tenggat / jadwal hari ini!">🔔 Hari Ini</span>':'';
  return `<article class="kanban-card" draggable="true" data-drag-card="${c.id}" style="--pillar:${p?.color||'#d2d9e3'}"><div class="kanban-cb-wrap"><input type="checkbox" class="kanban-card-cb" data-select="${c.id}" ${hub.selected.has(c.id)?'checked':''} title="Pilih kartu"></div><button class="kanban-open" data-open="${c.id}" aria-label="Buka ${esc(c.title)}"><div class="kanban-labels">${formatBadge(c.format)}${p?`<span class="kanban-label">${esc(p.name)}</span>`:''}${c.priority==='high'?'<span class="kanban-label priority">Prioritas tinggi</span>':''}</div><div class="kanban-title">${esc(c.title)}</div>${progressSummary(c)}<div class="content-status-row">${publicationBadge(c)}</div><div class="card-badges">${alertBadge}${due?`<span class="card-badge due ${late?'overdue':''}" title="Deadline ${esc(dateWib(c.deadline))}">${hubIcon('clock')}${date}</span>`:''}${c.scriptLength?`<span class="card-badge" title="Naskah tersimpan">${hubIcon('text')}</span>`:''}${c.owner?`<span class="member-avatar" title="${esc(c.owner)}" aria-label="Penanggung jawab ${esc(c.owner)}">${esc(initials)}</span>`:''}</div></button><div class="card-options-group"><button class="icon-button card-options" data-move-card="${c.id}" aria-label="Pindahkan ${esc(c.title)}" title="Pindahkan kartu">${hubIcon('move')}</button><button class="icon-button card-delete" data-delete-card="${c.id}" aria-label="Hapus ${esc(c.title)}" title="Hapus kartu">${hubIcon('trash')}</button></div></article>`;
}
function renderKanban(body){
  const items=filtered(),signature=JSON.stringify([items,items.map(c=>[c.id,linkedJob(c)?.status||(c.youtubeVideoId?'linked_youtube':'not_uploaded')]),hub.data.pillars,hub.data.columns,hub.composer,hub.columnMenu,hub.boardFilters]);
  if(hub.dragging)return;
  if(hub.boardSignature===signature&&body.querySelector('.board-shell'))return;
  const scroll=body.querySelector('.kanban')?.scrollLeft||0;
  const vertical=Object.fromEntries([...body.querySelectorAll('.kanban-column')].map(el=>[el.dataset.column,el.querySelector('.kanban-cards')?.scrollTop||0]));
  const focused=document.activeElement,wasComposer=focused?.matches('[name="cardTitle"]'),selection=wasComposer?[focused.selectionStart,focused.selectionEnd]:null;
  hub.boardSignature=signature;
  body.innerHTML=`<div class="board-shell"><div class="board-toolbar"><div class="board-title-group"><h2>Papan Produksi</h2><span class="board-pill">${hubIcon('board')} Papan</span><span class="board-count">${items.length} kartu · ${hub.data.columns.length} tahap</span></div><div class="board-actions"><button data-manage-columns aria-label="Atur kolom Kanban">${hubIcon('layers')}<span class="board-new-label">Kolom</span></button><button data-board-filter aria-expanded="${hub.boardFilters}" aria-controls="hubFilters">${hubIcon('filter')} Filter</button><button data-add-card="${hub.data.columns[0].id}" aria-label="Tambah konten baru" style="background:#0c66e4;font-weight:700;padding:7px 14px">${hubIcon('plus')}<span class="board-new-label">+ Konten Baru (N)</span></button></div></div><div class="kanban" aria-label="Papan produksi, geser horizontal untuk melihat semua tahap">${Object.entries(STAGE_NAMES).map(([stage,label])=>{const cards=items.filter(c=>c.stage===stage),composer=hub.composer?.stage===stage;return `<section class="kanban-column" data-column="${stage}" aria-label="${esc(label)}"><div class="column-head"><strong class="column-name">${statusBadge('production',stage)}</strong><span class="column-count">${cards.length}</span><button class="icon-button" data-add-card="${stage}" aria-label="Tambah kartu di ${esc(label)}" title="Tambah kartu (${esc(label)})">${hubIcon('plus')}</button><button class="icon-button" data-column-menu="${stage}" aria-label="Menu kolom ${esc(label)}" aria-expanded="${hub.columnMenu===stage}">${hubIcon('more')}</button></div>${hub.columnMenu===stage?`<div class="column-menu"><button data-add-card="${stage}">${hubIcon('plus')} Tambah kartu</button><button data-edit-column="${stage}">${hubIcon('layers')} Ubah kolom</button><button data-stage-library="${stage}">${hubIcon('folder')} Lihat di Semua Konten</button></div>`:''}${composer?`<form class="card-composer" data-composer="${stage}" style="margin-bottom:8px"><textarea name="cardTitle" aria-label="Judul kartu baru" placeholder="Ketik judul, tekan Enter untuk simpan kilat…" rows="2" required${hub.composer.saving?' disabled':''}>${esc(hub.composer.title)}</textarea>${hub.composer.error?`<div class="composer-error" role="alert">${esc(hub.composer.error)}</div>`:''}<div class="composer-actions"><button class="btn primary mini"${hub.composer.saving?' disabled':''}>${hub.composer.saving?'Menyimpan…':'Simpan (Enter)'}</button><button type="button" class="icon-button" data-cancel-composer aria-label="Batal tambah kartu"${hub.composer.saving?' disabled':''}>${hubIcon('close')}</button><span style="font-size:10px;color:#626f86;margin-left:auto;white-space:nowrap">↵ Simpan · Esc Batal</span></div></form>`:''}<div class="kanban-cards">${cards.map(kanbanCard).join('')}</div>${!composer?`<button class="board-add" data-add-card="${stage}">${hubIcon('plus')} Tambahkan kartu</button>`:''}</section>`}).join('')}<button class="board-add-column" data-manage-columns>${hubIcon('plus')} Tambah kolom</button></div><p class="hub-footer">Geser papan untuk melihat semua tahap. Tarik kartu atau gunakan tombol pindah pada kartu untuk mengubah tahap.</p></div>`;
  body.querySelector('.kanban').scrollLeft=scroll;
  body.querySelectorAll('.kanban-column').forEach(el=>el.querySelector('.kanban-cards').scrollTop=vertical[el.dataset.column]||0);
  if(wasComposer&&hub.composer&&!hub.composer.saving){const input=body.querySelector('[name="cardTitle"]');input?.focus({preventScroll:true});if(selection)input?.setSelectionRange(...selection)}
  renderBulkBar();
}
function showComposer(stage){
  if(hub.composer?.saving)return;
  if(hub.composer?.title.trim()&&hub.composer.stage!==stage){toast('Selesaikan atau batalkan kartu yang sedang ditulis.');return}
  hub.composer={stage,title:hub.composer?.title||'',saving:false,error:''};hub.columnMenu=null;renderHub();
  const input=$('#hubBody [name="cardTitle"]');input?.closest('.kanban-column')?.scrollIntoView({block:'nearest',inline:'nearest'});input?.focus();
}
async function moveContent(id,stage){
  const c=hub.data.contents.find(c=>c.id===id);if(!c)throw Error('Konten tidak ditemukan. Muat ulang papan.');
  if(c.stage===stage)return;
  const oldStage=c.stage,oldRev=c.revision;
  c.stage=stage;c.updatedAt=new Date().toISOString();
  saveHubCache();renderHub();
  toast('Kartu dipindahkan ke '+(STAGE_NAMES[stage]||stage)+'.');
  try{
    const result=await api('/api/contents/'+id,{method:'PATCH',body:JSON.stringify({revision:oldRev,stage})});
    hub.data.contents=hub.data.contents.map(item=>item.id===id?contentSummary(result.content):item);
    saveHubCache();
  }catch(err){
    c.stage=oldStage;c.revision=oldRev;
    saveHubCache();renderHub();
    toast('Gagal memindahkan: '+err.message);
    void loadHub();
  }
}
async function deleteCard(id){
  const c=hub.data.contents.find(item=>item.id===id);
  const title=c?.title||'konten ini';
  if(!confirm(`Hapus "${title}" beserta naskah dan riwayatnya secara permanen?`))return;
  const oldIndex=hub.data.contents.indexOf(c);
  hub.data.contents=hub.data.contents.filter(item=>item.id!==id);
  saveHubCache();renderHub();
  toast('Konten berhasil dihapus.');
  try{
    await api('/api/contents/'+id,{method:'DELETE',body:JSON.stringify({revision:c?.revision})});
    saveHubCache();
  }catch(err){
    if(c&&oldIndex!==-1)hub.data.contents.splice(oldIndex,0,c);
    saveHubCache();renderHub();
    toast('Gagal menghapus: '+err.message);
    void loadHub();
  }
}
function showMoveCard(id){
  const c=hub.data.contents.find(c=>c.id===id);if(!c)return;
  hub.moveCard=id;$('#moveCardTitle').textContent=c.title;$('#moveCardStage').innerHTML=options(Object.entries(STAGE_NAMES),c.stage);$('#moveCardError').classList.add('hide');$('#moveCardDialog').showModal();
}
$('#closeMoveCard').onclick=()=>$('#moveCardDialog').close();
$('#deleteFromMoveDialog').onclick=async()=>{
  const id=hub.moveCard;if(!id)return;
  $('#moveCardDialog').close();
  await deleteCard(id);
};
$('#moveCardForm').onsubmit=async e=>{e.preventDefault();const button=$('#confirmMoveCard');button.disabled=true;try{await moveContent(hub.moveCard,$('#moveCardStage').value);$('#moveCardDialog').close()}catch(err){$('#moveCardError').textContent=err.message;$('#moveCardError').classList.remove('hide');void loadHub()}finally{button.disabled=false}};
function calendarEvents(){const items=filtered().map(c=>({...c,eventAt:eventDate(c)})).filter(c=>c.eventAt);if(hub.calendarField==='publish'&&!$('#archiveFilter').checked&&!$('#pillarFilter').value&&!$('#stageFilter').value){const q=$('#contentSearch').value.toLowerCase();for(const j of state.server?.jobs||[]){if(!j.contentId&&j.status!=='cancelled'&&j.scheduledAt&&(!q||j.title.toLowerCase().includes(q))){const format=j.videoFormat||'',f=$('#formatFilter').value;if(!f||format===f)items.push({id:j.id,title:j.title,format,eventAt:j.scheduledAt,jobOnly:true,stage:'ready'})}}}return items.sort((a,b)=>Date.parse(a.eventAt)-Date.parse(b.eventAt))}
function calendarEvent(c){const collisions=calendarEvents().filter(x=>x.eventAt===c.eventAt).length,j=c.jobOnly?state.server?.jobs.find(j=>j.id===c.id):linkedJob(c);return `<button class="calendar-event ${publicationState(c)==='published'?'is-published':''}"${!c.jobOnly&&!activeJob(c)&&!c.youtubeVideoId?' draggable="true"':''} data-event="${c.id}" data-job-only="${c.jobOnly?'yes':''}" style="--pillar:${pillar(c)?.color||'#8695b0'}"><span class="calendar-category">${formatBadge(c.format)}</span><strong>${esc(c.title)}</strong><small>${timeWib(c.eventAt)}${c.jobOnly||c.youtubeVideoId?' · YouTube':j?'':' · Rencana'}${collisions>1?' · ⚠ Jadwal bersamaan':''}</small><span class="calendar-status-row">${c.jobOnly||publicationState(c)==='published'?'':productionBadge(c)}${c.jobOnly?(j?statusBadge('publication',j.status):''):publicationBadge(c)}</span></button>`}
function renderCalendar(body){const events=calendarEvents(),month=hub.date.toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});const signature=JSON.stringify([events.map(e=>[e.id,e.title,e.eventAt,e.format,e.stage]),month,hub.mode,hub.calendarField,hub.data.pillars]);if(hub.calendarSignature===signature&&body.querySelector('#calendarContent'))return;hub.calendarSignature=signature;body.innerHTML=`<div class="calendar-toolbar"><div class="calendar-controls"><button class="btn mini" data-cal-move="-1" aria-label="Periode sebelumnya">←</button><button class="btn mini" data-cal-today>Hari ini</button><button class="btn mini" data-cal-move="1" aria-label="Periode berikutnya">→</button><strong>${month}</strong></div><div class="calendar-controls"><select id="calendarField" class="btn mini" aria-label="Jenis tanggal"><option value="publish"${hub.calendarField==='publish'?' selected':''}>Jadwal tayang</option><option value="deadline"${hub.calendarField==='deadline'?' selected':''}>Deadline produksi</option></select>${[['month','Bulan'],['week','Minggu'],['agenda','Agenda']].map(([v,l])=>`<button class="btn mini ${hub.mode===v?'primary':''}" data-cal-mode="${v}">${l}</button>`).join('')}</div></div><div class="pillars-summary">${hub.data.pillars.map(p=>pillarTag({pillarId:p.id})).join('')}</div><div id="calendarContent"></div><p class="hub-footer">WIB · Kartu rencana bisa digeser ke tanggal lain. Status tayang mengikuti pemeriksaan YouTube. Video yang sudah ditautkan diperbarui otomatis sekitar 5 menit; perubahan jadwal dilakukan melalui YouTube Studio.</p>`;const box=$('#calendarContent');let start,end;if(hub.mode==='month'){const first=new Date(Date.UTC(hub.date.getUTCFullYear(),hub.date.getUTCMonth(),1));start=shiftDay(first,-((first.getUTCDay()+6)%7));end=shiftDay(start,42)}else if(hub.mode==='week'){start=shiftDay(hub.date,-((hub.date.getUTCDay()+6)%7));end=shiftDay(start,7)}else{start=new Date(Date.UTC(hub.date.getUTCFullYear(),hub.date.getUTCMonth(),1));end=new Date(Date.UTC(hub.date.getUTCFullYear(),hub.date.getUTCMonth()+1,1))}if(hub.mode==='agenda'){const grouped={};events.filter(c=>calendarDate(dayKey(c.eventAt))>=start&&calendarDate(dayKey(c.eventAt))<end).forEach(c=>(grouped[dayKey(c.eventAt)]??=[]).push(c));box.innerHTML=Object.entries(grouped).map(([day,cs])=>`<div class="agenda-date">${calendarDate(day).toLocaleDateString('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'})} <button class="btn mini" data-new-date="${day}">+ Konten</button></div><div class="agenda-list">${cs.map(c=>`<div>${calendarEvent(c)}</div>`).join('')}</div>`).join('')||'<div class="empty">Belum ada jadwal pada bulan ini. Konten tanpa tanggal tetap tersedia di Kanban dan Semua Konten.</div>';return}let days='';for(let day=new Date(start);day<end;day=shiftDay(day,1)){const key=keyUTC(day),cs=events.filter(c=>dayKey(c.eventAt)===key);days+=`<div class="calendar-day ${day.getUTCMonth()!==hub.date.getUTCMonth()?'other':''} ${key===dayKey()?'today':''}" data-day="${key}"><div class="day-heading"><span class="day-number">${day.getUTCDate()}</span><button data-new-date="${key}" aria-label="Tambah konten ${key}">+</button></div>${cs.map(calendarEvent).join('')}</div>`}box.innerHTML=`<div class="calendar-wrap"><div class="calendar-grid">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(l=>`<div class="weekday">${l}</div>`).join('')}${days}</div></div>`}
function renderLibrary(body){const items=filtered();const allSelected=items.length>0&&items.every(c=>hub.selected.has(c.id));const signature=JSON.stringify([items.map(c=>[c.id,c.title,c.stage,c.format,c.owner,c.updatedAt]),[...hub.selected]]);if(hub.librarySignature===signature&&body.querySelector('.content-table')){renderBulkBar();return;}hub.librarySignature=signature;body.innerHTML=items.length?`<div class="table-scroll"><table class="content-table"><thead><tr><th style="width:36px;text-align:center"><input type="checkbox" id="selectAllContent" ${allSelected?'checked':''} title="Pilih Semua"></th><th>Konten</th><th>Pilar / Kategori video</th><th>Produksi</th><th>Publikasi</th><th>Penanggung jawab</th><th>Rencana tayang (WIB)</th><th style="text-align:right">Aksi</th></tr></thead><tbody>${items.map(c=>{const alertSt=contentAlertStatus(c),alertPill=alertSt==='overdue'?'<span class="alert-pill overdue">⚠️ Lewat Tenggat</span>':alertSt==='today'?'<span class="alert-pill today">🔔 Hari Ini</span>':'';return `<tr><td style="text-align:center"><input type="checkbox" class="content-select-cb" data-select="${c.id}" ${hub.selected.has(c.id)?'checked':''}></td><td><button class="link-button" data-open="${c.id}">${esc(c.title)}</button> ${alertPill}<div class="hint">${c.scriptLength?'Script tersimpan · ':''}${c.archived?'Diarsipkan':'Diperbarui '+dateWib(c.updatedAt)}</div></td><td>${pillarTag(c)}<div class="content-format-label">${formatBadge(c.format)}</div></td><td>${productionBadge(c)}${progressSummary(c)}</td><td>${publicationBadge(c)}</td><td>${esc(c.owner||'—')}</td><td>${dateWib(eventDate(c))}</td><td style="text-align:right"><button type="button" class="btn mini danger" data-delete-card="${c.id}" aria-label="Hapus ${esc(c.title)}" style="padding:4px 8px;font-size:11px">${hubIcon('trash')} Hapus</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty">Tidak ada konten yang cocok. Tambahkan ide baru atau ubah filter.</div>';renderBulkBar()}
function renderSettings(body){const signature=JSON.stringify(hub.data.pillars);if(body.querySelector('.pillar-setting')&&hub.settingsSignature===signature)return;hub.settingsSignature=signature;body.innerHTML=`<div class="hub-panel"><h3>Warna pilar</h3><p class="hint">Nama dan warna ini digunakan di Kalender, Kanban, dan daftar konten.</p>${hub.data.pillars.map(p=>`<form class="pillar-setting" data-pillar="${p.id}"><input type="color" name="color" value="${p.color}" aria-label="Warna ${esc(p.name)}"><input name="name" type="text" value="${esc(p.name)}" required aria-label="Nama pilar"><button class="btn mini">Simpan</button></form>`).join('')}<h3 style="margin-top:25px">Tambah pilar</h3><form class="pillar-setting" data-pillar=""><input type="color" name="color" value="#346dff" aria-label="Warna pilar baru"><input name="name" type="text" placeholder="Nama pilar baru" required aria-label="Nama pilar baru"><button class="btn primary mini">Tambah</button></form></div>`}
$('#hubBody').onsubmit=async e=>{
  if(e.target.matches('.card-composer')){
    e.preventDefault();const composer=hub.composer;if(!composer||composer.saving)return;
    composer.title=e.target.elements.cardTitle.value;const title=composer.title.trim();if(!title)return;
    composer.saving=true;composer.error='';renderHub();
    try{
      const result=await api('/api/contents',{method:'POST',body:JSON.stringify({title,stage:composer.stage,pillarId:$('#pillarFilter').value,format:$('#formatFilter').value||'shorts',archived:$('#archiveFilter').checked})});
      hub.data.contents.unshift(contentSummary(result.content));
      saveHubCache();
      composer.title='';
      composer.saving=false;
      renderHub();
      toast('Kartu ditambahkan.');
      const input=$('#hubBody [name="cardTitle"]');
      input?.focus();
      void loadHub();
    }
    catch(err){composer.saving=false;composer.error=err.message;renderHub();$('#hubBody [name="cardTitle"]')?.focus()}return;
  }
  if(!e.target.matches('.pillar-setting'))return;e.preventDefault();const form=e.target;try{await api('/api/pillars',{method:'POST',body:JSON.stringify({id:form.dataset.pillar||undefined,name:form.elements.name.value,color:form.elements.color.value})});await loadHub();toast('Pilar tersimpan.')}catch(err){toast(err.message)}};
$('#hubBody').onkeydown=e=>{
  if(e.target.matches('.card-composer [name="cardTitle"]')){
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!e.target.value.trim()){
        hub.composer=null;
        renderHub();
        return;
      }
      e.target.closest('form')?.requestSubmit();
    }else if(e.key==='Escape'){
      e.preventDefault();
      hub.composer=null;
      renderHub();
    }
  }
};
document.addEventListener('keydown',e=>{
  if(hub.view==='kanban'&&!hub.editing&&!document.querySelector('dialog[open]')){
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    if(['input','textarea','select'].includes(tag))return;
    if((e.key==='n'||e.key==='N'||e.key==='c'||e.key==='C')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      e.preventDefault();
      showComposer(hub.data.columns[0]?.id||'idea');
    }
  }
});
$('#hubBody').oninput=e=>{if(e.target.name==='cardTitle'&&hub.composer){hub.composer.title=e.target.value;hub.composer.error=''}};
$('#hubBody').onclick=async e=>{
  if(e.target.closest('[data-select]')||e.target.id==='selectAllContent'){e.stopPropagation();return}
  if(e.target.id==='dashViewAlerts'){const b=$('#alertFilter');if(b)b.checked=true;navigate('library');return}
  const action=e.target.closest('[data-add-card],[data-cancel-composer],[data-column-menu],[data-stage-library],[data-board-filter],[data-move-card],[data-delete-card]');
  if(action){
    if(action.dataset.deleteCard){e.stopPropagation();await deleteCard(action.dataset.deleteCard);return}
    if(action.dataset.addCard)showComposer(action.dataset.addCard);
    if(action.hasAttribute('data-cancel-composer')&&!hub.composer?.saving){hub.composer=null;renderHub()}
    if(action.dataset.columnMenu){hub.columnMenu=hub.columnMenu===action.dataset.columnMenu?null:action.dataset.columnMenu;renderHub()}
    if(action.dataset.stageLibrary){$('#stageFilter').value=action.dataset.stageLibrary;hub.columnMenu=null;navigate('library')}
    if(action.hasAttribute('data-board-filter')){hub.boardFilters=!hub.boardFilters;renderHub();if(hub.boardFilters)$('#contentSearch').focus()}
    if(action.dataset.moveCard)showMoveCard(action.dataset.moveCard);return;
  }
  const el=e.target.closest('[data-card],[data-open],[data-event],[data-go],[data-new-stage],[data-new-date],[data-cal-mode],[data-cal-move],[data-cal-today]');if(!el)return;try{if(el.dataset.card||el.dataset.open)await openContent(el.dataset.card||el.dataset.open);if(el.dataset.event){if(el.dataset.jobOnly==='yes')openJobFormat(el.dataset.event);else await openContent(el.dataset.event)}if(el.dataset.go)navigate(el.dataset.go);if(el.dataset.newStage)await newContent({stage:el.dataset.newStage});if(el.dataset.newDate)await newContent({[hub.calendarField==='deadline'?'deadline':'plannedPublishAt']:inputIso(el.dataset.newDate+'T09:00')});if(el.dataset.calMode){hub.mode=el.dataset.calMode;renderHub()}if(el.dataset.calMove){const n=Number(el.dataset.calMove);if(hub.mode==='week')hub.date=shiftDay(hub.date,n*7);else hub.date=new Date(Date.UTC(hub.date.getUTCFullYear(),hub.date.getUTCMonth()+n,1));renderHub()}if(el.hasAttribute('data-cal-today')){hub.date=calendarDate(dayKey());renderHub()}}catch(err){toast(err.message)}};
$('#hubBody').onchange=e=>{
  if(e.target.id==='calendarField'){hub.calendarField=e.target.value;renderHub();return}
  if(e.target.id==='selectAllContent'){
    const items=filtered();
    if(e.target.checked)items.forEach(c=>hub.selected.add(c.id));
    else items.forEach(c=>hub.selected.delete(c.id));
    renderHub();
    return;
  }
  const sel=e.target.closest('[data-select]');
  if(sel){
    const id=sel.dataset.select;
    if(sel.checked)hub.selected.add(id);
    else hub.selected.delete(id);
    renderHub();
    return;
  }
};
$('#hubBody').onkeydown=e=>{
  if(e.target.name==='cardTitle'){
    if(e.key==='Escape'&&!hub.composer?.saving){e.preventDefault();hub.composer=null;renderHub();return}
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.target.form.requestSubmit();return}
  }
  if(e.target.matches('[data-card]')&&['Enter',' '].includes(e.key)){e.preventDefault();openContent(e.target.dataset.card).catch(err=>toast(err.message))}};
$('#hubBody').ondragstart=e=>{
  const el=e.target.closest('[data-drag-card],[data-card],[data-event]');
  if(el&&!el.dataset.jobOnly){hub.dragging=true;e.dataTransfer.setData('text/plain',el.dataset.dragCard||el.dataset.card||el.dataset.event);e.dataTransfer.effectAllowed='move';el.classList.add('dragging')}
};
$('#hubBody').ondragend=()=>{hub.dragging=false;document.querySelectorAll('.drop-over,.dragging').forEach(el=>el.classList.remove('drop-over','dragging'));renderHub()};
$('#hubBody').ondragover=e=>{const target=e.target.closest('[data-column],[data-day]');if(target){e.preventDefault();e.dataTransfer.dropEffect='move';target.classList.add('drop-over');const board=$('#hubBody .kanban');if(board){const rect=board.getBoundingClientRect();if(e.clientX>rect.right-50)board.scrollLeft+=18;else if(e.clientX<rect.left+50)board.scrollLeft-=18}}};
$('#hubBody').ondragleave=e=>{const target=e.target.closest('[data-column],[data-day]');if(target&&!target.contains(e.relatedTarget))target.classList.remove('drop-over')};
$('#hubBody').ondrop=async e=>{
  const target=e.target.closest('[data-column],[data-day]');if(!target)return;e.preventDefault();target.classList.remove('drop-over');hub.dragging=false;
  const c=hub.data.contents.find(c=>c.id===e.dataTransfer.getData('text/plain'));if(!c)return;
  try{
    if(target.dataset.column){await moveContent(c.id,target.dataset.column);return}
    const patch={revision:c.revision};
    if(hub.calendarField==='publish'&&(activeJob(c)||c.youtubeVideoId))return toast('Jadwal upload YouTube dikelola di YouTube Studio.');
    const dateField=hub.calendarField==='deadline'?'deadline':'plannedPublishAt';
    const oldDate=c[dateField];
    const old=eventDate(c);
    const targetIso=inputIso(target.dataset.day+'T'+(old?wibInput(old).slice(11):'09:00'));
    patch[dateField]=targetIso;
    c[dateField]=targetIso;c.updatedAt=new Date().toISOString();
    saveHubCache();renderHub();
    toast('Jadwal diperbarui.');
    try{
      const res=await api('/api/contents/'+c.id,{method:'PATCH',body:JSON.stringify(patch)});
      hub.data.contents=hub.data.contents.map(item=>item.id===c.id?contentSummary(res.content):item);
      saveHubCache();
    }catch(err){
      c[dateField]=oldDate;
      saveHubCache();renderHub();
      toast('Gagal mengubah jadwal: '+err.message);
      void loadHub();
    }
  }catch(err){toast(err.message);await loadHub()}
};
document.addEventListener('click',e=>{if(hub.columnMenu&&!e.target.closest('[data-column-menu],.column-menu')){hub.columnMenu=null;if(hub.view==='kanban')renderHub()}});
async function newContent(fields={},draftId=null){if(hub.editing&&!await closeEditor())return;const now=new Date().toISOString(),c={title:'',stage:hub.data.columns[0].id,pillarId:'',format:'shorts',priority:'normal',owner:'',deadline:null,plannedPublishAt:null,brief:'',audience:'',hook:'',script:'',cta:'',productionNotes:'',description:'',tags:'',sources:[],assets:[],publicationLinks:[],archived:false,checklist:{script:false,video:false,thumbnail:false,review:false},...fields,id:draftId||crypto.randomUUID(),revision:0,createdAt:now,updatedAt:now,history:[]};hub.editing={content:c,isNew:true,dirty:false,saving:null,epoch:0};formValue('stage').innerHTML=options(Object.entries(STAGE_NAMES));formValue('pillarId').innerHTML=options([['','Tanpa pilar'],...hub.data.pillars.map(p=>[p.id,p.name])]);$('#editorConflict').classList.add('hide');fillForm(c);$('#editorHeading').textContent=c.title||'Konten baru';switchTab('plan');$('#saveIndicator').textContent='Draft baru · klik Simpan';$('#contentEditor').showModal();showDraftBanner();if(draftHasContent(c))markDirty()}
$('#newContent').onclick=()=>newContent().catch(e=>toast(e.message));
function formValue(name){return hubForm.elements.namedItem(name)}
function fillForm(c){$('#contentEditor .editor-menu').open=false;$('#manualYouTubeVideo').value='';$('#contentEngineResult').textContent='';for(const key of ['title','stage','pillarId','format','priority','owner','audience','brief','productionNotes','script','description','tags'])formValue(key).value=c[key]||'';for(const key of richContentFields)HubRichText.set(formValue(key),c[key],c.richText?.[key]);storyboardEditor.load();for(const key of ['deadline','plannedPublishAt'])formValue(key).value=wibInput(c[key]);$('#editorHeading').textContent=c.title;$('#editorHeading').title=c.title;$('#archiveContent').textContent=c.archived?'Pulihkan dari arsip':'Arsipkan';$('#contentChecklist').innerHTML=Object.entries(CHECK_NAMES).map(([k,l])=>`<label><input type="checkbox" data-check="${k}"${c.checklist[k]?' checked':''}> ${l}</label>`).join('');renderResearch();renderEditorMeta();scriptStats();window.HubPublicationLinksUI?.load()}
async function openContent(id){const draft=storedDraft(id);if(draft?.isNew)return newContent(draft.fields,id);if(hub.editing?.isNew){if(!await closeEditor())return}else if(hub.editing&&!await flushSave())return;const r=await api('/api/contents/'+id);hub.editing={content:r.content,dirty:false,saving:null,epoch:0};formValue('stage').innerHTML=options(Object.entries(STAGE_NAMES));formValue('pillarId').innerHTML=options([['','Tanpa pilar'],...hub.data.pillars.map(p=>[p.id,p.name])]);$('#editorConflict').classList.add('hide');fillForm(r.content);switchTab('plan');$('#saveIndicator').textContent='Tersimpan di server';$('#contentEditor').showModal();showDraftBanner();const pending=storedDraft(id);if(pending?.id===id&&confirm('Ada draft lokal yang belum tersimpan untuk konten ini. Pulihkan draft tersebut?')){const c={...r.content,...pending.fields};hub.editing.content=c;fillForm(c);markDirty();if(pending.revision!==r.content.revision){hub.editing.conflict=true;clearTimeout(hub.timer);showConflict('Draft berasal dari versi lama. Periksa perubahan sebelum menekan Simpan sekarang.')}}}
function switchTab(tab){$('#contentEditor').dataset.activeTab=tab;$('#editorProgress').open=false;document.querySelectorAll('#contentEditor details[open]').forEach(d=>d.open=false);document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(active));b.setAttribute('aria-controls','editor-panel-'+b.dataset.tab);b.id='editor-tab-'+b.dataset.tab;b.tabIndex=active?0:-1;});document.querySelectorAll('[data-panel]').forEach(p=>{p.classList.toggle('hide',p.dataset.panel!==tab);p.id='editor-panel-'+p.dataset.panel;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','editor-tab-'+p.dataset.panel);});renderEditorMeta()}
// Auxiliary panels float over the worksheet and never reserve a permanent row.
const workspacePopovers=[...document.querySelectorAll('#contentEditor .editor-menu,#editorProgress,#storyboardSheet details')];
for(const panel of workspacePopovers)panel.addEventListener('toggle',()=>{if(panel.open)for(const other of workspacePopovers)if(other!==panel)other.open=false;});
$('#contentEditor').addEventListener('click',e=>{for(const panel of workspacePopovers)if(panel.open&&!panel.contains(e.target))panel.open=false;});
$('#contentEditor').addEventListener('keydown',e=>{if(e.key!=='Escape')return;const panel=workspacePopovers.find(p=>p.open);if(panel){e.preventDefault();e.stopPropagation();panel.open=false;panel.querySelector('summary').focus();}});
document.querySelector('.editor-tabs').onclick=e=>{if(e.target.dataset.tab)switchTab(e.target.dataset.tab)};
document.querySelector('.editor-tabs').onkeydown=e=>{const tabs=[...document.querySelectorAll('.editor-tabs [data-tab]')],index=tabs.indexOf(e.target);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTab(tabs[next].dataset.tab);tabs[next].focus();};
function readForm(){const c=hub.editing.content,out={};for(const key of ['title','stage','pillarId','format','priority','owner','audience','brief','productionNotes','script','description','tags'])out[key]=formValue(key).value;for(const key of ['deadline','plannedPublishAt'])out[key]=inputIso(formValue(key).value);out.sources=c.sources.filter(item=>[item.label,item.url,item.notes].some(value=>value.trim()));out.assets=c.assets.filter(item=>[item.label,item.url,item.notes].some(value=>value.trim()));out.checklist=Object.fromEntries([...document.querySelectorAll('[data-check]')].map(el=>[el.dataset.check,el.checked]));if(hub.editing.isNew&&c.radarIssueId)out.radarIssueId=c.radarIssueId;out.publicationLinks=structuredClone(c.publicationLinks||[]);out.archived=c.archived;out.hook=c.hook||'';out.cta=c.cta||'';out.richText={...Object.fromEntries(['hook','cta'].filter(key=>c.richText?.[key]).map(key=>[key,c.richText[key]])),...Object.fromEntries(richContentFields.map(key=>[key,HubRichText.html(formValue(key))]))};return out}
function markDirty(){if(!hub.editing)return;hub.editing.dirty=true;hub.editing.epoch++;$('#saveIndicator').textContent='Perubahan belum tersimpan…';try{const fields=readForm();if(hub.editing.isNew&&!draftHasContent(fields))clearLocalDraft(hub.editing.content.id);else{const value=JSON.stringify({id:hub.editing.content.id,revision:hub.editing.content.revision,fields,isNew:!!hub.editing.isNew,epoch:hub.editing.epoch,at:Date.now()});localStorage.setItem('yt-hub-draft-'+hub.editing.content.id,value);localStorage.setItem('yt-hub-pending',value)}}catch{}clearTimeout(hub.timer);if(!hub.editing.conflict&&!hub.editing.isNew)hub.timer=setTimeout(flushSave,1000);scriptStats();renderEditorProgress()}
hubForm.oninput=e=>{if(e.target.dataset.research){const c=hub.editing.content,item=c[e.target.dataset.research].find(x=>x.id===e.target.dataset.row);if(item)item[e.target.dataset.field]=e.target.type==='checkbox'?e.target.checked:e.target.value}markDirty()};
hubForm.onchange=e=>{if(e.target.matches('select,input[type=checkbox]'))hubForm.oninput(e)};
hubForm.onsubmit=e=>{e.preventDefault();flushSave()};
$('#contentChecklist').onchange=()=>markDirty();
function showConflict(message){$('#editorConflict').classList.remove('hide');$('#conflictText').textContent=message}
async function flushSave(){clearTimeout(hub.timer);const edit=hub.editing;if(!edit)return true;if(edit.isNew&&!edit.dirty){showConflict('Isi judul sebelum menyimpan. Konten kosong tidak disimpan.');return false;}if(edit.saving)return edit.saving;edit.saving=(async()=>{while(edit.dirty){const epoch=edit.epoch;let fields;try{fields=readForm();if(!fields.title.trim())throw Error('Judul wajib diisi. Draft tetap disimpan di browser.');$('#saveIndicator').textContent='Menyimpan…';const previousId=edit.content.id;const r=await api('/api/contents'+(edit.isNew?'':'/'+edit.content.id),{method:edit.isNew?'POST':'PATCH',body:JSON.stringify({...fields,...(edit.isNew?{}:{revision:edit.content.revision})})});const pendingAssets=edit.content.assets,pendingSources=edit.content.sources,pendingPublicationLinks=edit.content.publicationLinks;edit.content=r.content;edit.isNew=false;edit.content.sources=pendingSources;edit.content.assets=pendingAssets;if(epoch!==edit.epoch)edit.content.publicationLinks=pendingPublicationLinks||[];if(epoch===edit.epoch){clearLocalDraft(previousId);edit.dirty=false;}else{try{const value=JSON.stringify({id:edit.content.id,revision:edit.content.revision,fields:readForm(),isNew:false,epoch:edit.epoch,at:Date.now()});localStorage.setItem('yt-hub-draft-'+edit.content.id,value);localStorage.setItem('yt-hub-pending',value);if(previousId!==edit.content.id)clearLocalDraft(previousId);}catch{}}edit.conflict=false;$('#editorConflict').classList.add('hide');$('#editorHeading').textContent=r.content.title;$('#saveIndicator').textContent=edit.dirty?'Menyimpan perubahan berikutnya…':'Tersimpan di server';if(!edit.dirty){clearLocalDraft(edit.content.id)}renderEditorMeta();}catch(err){edit.dirty=true;edit.conflict=true;$('#saveIndicator').textContent='Belum tersimpan — draft dipertahankan';showConflict(err.message);return false}}void loadHub();showDraftBanner();return true})();try{return await edit.saving}finally{edit.saving=null}}
$('#saveContent').onclick=()=>flushSave();
$('#fillContentEngine').onclick=async()=>{
 const edit=hub.editing;if(!edit)return;const epoch=edit.epoch,button=$('#fillContentEngine');button.disabled=true;
 try{
  const result=await api('/api/contents/engine-preview',{method:'POST',body:JSON.stringify({...readForm(),id:edit.content.id})});
  if(hub.editing!==edit||edit.epoch!==epoch)return toast('Konten berubah selama engine bekerja. Jalankan kembali untuk memakai bahan terbaru.');
  const keys=[];
  for(const [key,value] of Object.entries(result.fields)){
   if(['hook','cta'].includes(key)){if(!edit.content[key]?.trim()){edit.content[key]=value;keys.push(key);}continue;}
   const field=formValue(key);if(!field||field.value.trim())continue;
   if(richContentFields.includes(key))HubRichText.set(field,value);else field.value=value;keys.push(key);
  }
  $('#contentEngineResult').textContent=(keys.length?'Engine mengisi '+keys.length+' kolom kosong tanpa kuota AI. ':'Tidak ada kolom kosong yang bisa diisi dari bahan ini. ')+result.warnings.join(' ');
  if(keys.includes('productionNotes'))storyboardEditor.load();
  if(keys.length){markDirty();await flushSave();}toast(keys.length?'Kolom kosong diisi dari materi tersimpan.':'Lengkapi bahan riset atau naskah terlebih dahulu.');
 }catch(e){toast(e.message)}finally{button.disabled=false;}
};
$('#linkManualYouTube').onclick=async()=>{
 if(!hub.editing||!await flushSave())return;const edit=hub.editing,epoch=edit.epoch,button=$('#linkManualYouTube');button.disabled=true;
 try{
  const result=await api('/api/contents/'+edit.content.id+'/publication',{method:'POST',body:JSON.stringify({revision:edit.content.revision,video:$('#manualYouTubeVideo').value||edit.content.youtubeVideoId})});
  if(hub.editing!==edit)return;
  edit.content={...edit.content,...result.content,...(edit.epoch!==epoch?{sources:edit.content.sources,assets:edit.content.assets}:{})};
  renderEditorMeta();void loadHub();toast('Status YouTube: '+publication(edit.content));
 }catch(e){toast(e.message);void refresh()}finally{button.disabled=false;}
};
async function closeEditor(){if(hub.editing?.saving)return false;if(hub.editing?.isNew){if(hub.editing.dirty&&!confirm('Tutup tanpa menyimpan konten baru? Draft tetap dapat dipulihkan.'))return false}else if(!await flushSave())return false;hub.editing=null;$('#contentEditor').close();showDraftBanner();return true}
$('#closeEditor').onclick=closeEditor;$('#contentEditor').addEventListener('cancel',e=>{e.preventDefault();closeEditor()});
window.addEventListener('beforeunload',e=>{if(hub.editing?.dirty||state.uploading){e.preventDefault();e.returnValue=''}});
$('#reloadContent').onclick=async()=>{if(!confirm('Muat versi server dan abaikan perubahan lokal untuk konten ini?'))return;try{const id=hub.editing.content.id;clearTimeout(hub.timer);hub.editing=null;clearLocalDraft(id);showDraftBanner();$('#contentEditor').close();await openContent(id)}catch(err){toast(err.message)}};
function scriptStats(){if(!hub.editing)return;const text=formValue('script').value,words=text.trim().split(/\s+/).filter(Boolean).length,seconds=Math.round(words/140*60),duration=seconds>=60?`${Math.floor(seconds/60)} menit${seconds%60?' '+seconds%60+' detik':''}`:`${seconds} detik`;$('#scriptStats').textContent=`${words.toLocaleString('id-ID')} kata · ${text.length.toLocaleString('id-ID')} karakter · Estimasi narasi ${duration} (140 kata/menit)`;$('#copyScript').disabled=!text.trim();$('#openTeleprompter').disabled=!text.trim()}
$('#openTeleprompter').onclick=()=>{if(!hub.editing)return;const edit=hub.editing;HubTeleprompter.open({id:hub.editing.content.id,title:formValue('title').value||'Naskah konten',category:FORMAT_NAMES[formValue('format').value]||'Konten',text:formValue('script').value},toast,()=>{if(hub.editing===edit){switchTab('plan');$('#editor-tab-plan').focus();}})};
$('#copyScript').onclick=async()=>{const text=formValue('script').value;if(!text.trim())return;try{await navigator.clipboard.writeText(text);toast('Script disalin.')}catch{HubRichText.select(formValue('script'));toast('Pilih Salin pada script yang disorot.')}};
function productionProgress(checklist={}){const total=Object.keys(CHECK_NAMES).length,done=Object.keys(CHECK_NAMES).filter(key=>checklist[key]===true).length;return {done,total,percent:Math.round(done/total*100)}}
function progressSummary(c){const {done,total,percent}=productionProgress(c.checklist);return `<div class="content-progress ${percent===100?'is-complete':''}"><span>${done}/${total} selesai <b>${percent}%</b></span><progress class="production-progress-bar" max="100" value="${percent}" aria-label="Progres produksi ${esc(c.title)}"></progress></div>`}
function renderEditorProgress(){if(!hub.editing)return;const checklist=Object.fromEntries([...$('#contentChecklist').querySelectorAll('[data-check]')].map(el=>[el.dataset.check,el.checked])),{done,total,percent}=productionProgress(checklist);$('#editorProgressText').textContent=`${done}/${total} · ${percent}%`;$('#editorProgressBar').value=percent;$('#editorProgress').classList.toggle('is-complete',percent===100);const next=Object.keys(CHECK_NAMES).find(key=>!checklist[key]);$('#editorNextStep').textContent=next?'Berikutnya: '+CHECK_NAMES[next]:'Semua checklist produksi selesai.'}

function renderResearch(){for(const [key,box] of [['sources','sourceRows'],['assets','assetRows']]){$('#'+box).innerHTML=hub.editing.content[key].map(item=>`<div class="research-row"><div class="editor-fields"><label>Nama / keterangan<input data-research="${key}" data-row="${item.id}" data-field="label" value="${esc(item.label)}"></label><label>Tautan<input data-research="${key}" data-row="${item.id}" data-field="url" value="${esc(item.url)}" placeholder="https://…"></label><label class="span2">Catatan / data<textarea data-research="${key}" data-row="${item.id}" data-field="notes" rows="3">${esc(item.notes)}</textarea></label></div><div class="research-bottom"><label><input type="checkbox" data-research="${key}" data-row="${item.id}" data-field="verified"${item.verified?' checked':''}> ${key==='sources'?'Sudah diverifikasi':'Aset siap digunakan'}</label><button type="button" class="btn mini danger" data-remove-material="${item.id}" data-material-kind="${key}">Hapus</button></div></div>`).join('')||'<div class="empty">Belum ada bahan. Tambahkan catatan atau tautan referensi.</div>'}}
for(const [button,key] of [['addSource','sources'],['addAsset','assets']])$('#'+button).onclick=()=>{hub.editing.content[key].push({id:crypto.randomUUID(),label:'',url:'',notes:'',verified:false});renderResearch()};
hubForm.onclick=async e=>{const el=e.target.closest('[data-remove-material],[data-restore]');if(!el)return;try{if(el.dataset.removeMaterial){const key=el.dataset.materialKind;hub.editing.content[key]=hub.editing.content[key].filter(x=>x.id!==el.dataset.removeMaterial);renderResearch();markDirty()}if(el.dataset.restore){if(!await flushSave())return;if(!confirm('Pulihkan versi ini? Versi saat ini tetap tersimpan dalam riwayat.'))return;const r=await api('/api/contents/'+hub.editing.content.id,{method:'PATCH',body:JSON.stringify({revision:hub.editing.content.revision,restoreRevision:Number(el.dataset.restore)})});hub.editing.content=r.content;fillForm(r.content);await loadHub();toast('Versi dipulihkan.')}}catch(err){toast(err.message)}};
function renderEditorMeta(){
 if(!hub.editing)return;renderEditorProgress();
 for(const id of ['duplicateContent','archiveContent','deleteContent','reloadContent'])$('#'+id).disabled=!!hub.editing.isNew;
 const c=hub.editing.content,j=linkedJob(c),p=c.youtubeVideoId&&c.youtubePublication?.videoId===c.youtubeVideoId?c.youtubePublication:null;
 $('#editorStatusBadges').innerHTML=contentStatusRow(c);formValue('plannedPublishAt').disabled=!!activeJob(c)||!!c.youtubeVideoId;
 const reconnect=state.server?.youtubeAuth==='reconnect_required'||(!state.server?.youtubeConnected&&state.server?.youtubeWorker?.code==='youtube_auth_required')||(!state.server?.youtubeConnected&&/Token has been expired or revoked|invalid_grant/i.test(j?.error||''));
 $('#contentPublication').innerHTML=(reconnect?'<div class="notice"><span>Izin Google/YouTube kedaluwarsa atau dicabut. Hubungkan ulang sebelum upload atau cek status. File antrean dan naskah tetap tersimpan.</span><a class="btn mini" href="/auth/google">Hubungkan ulang YouTube</a></div>':'')+(p?`<div class="notice"><span>${publicationBadge(c)} · Diperiksa ${dateWib(p.checkedAt)}${p.scheduledAt?' · Tayang '+dateWib(p.scheduledAt):''}</span><a class="btn mini" target="_blank" rel="noopener" href="https://studio.youtube.com/video/${encodeURIComponent(c.youtubeVideoId)}/edit">YouTube Studio</a></div>`:j?`<div class="notice"><span>${statusBadge('publication',j.status)} · ${dateWib(j.scheduledAt)}${j.error?' · '+esc(j.error):''}</span>${j.youtubeVideoId?`<a class="btn mini" target="_blank" rel="noopener" href="https://studio.youtube.com/video/${encodeURIComponent(j.youtubeVideoId)}/edit">YouTube Studio</a>`:''}${j.status==='failed'&&!reconnect?'<button type="button" class="btn mini" data-content-retry>Ulangi antrean tersimpan</button>':''}</div>`:c.youtubeVideoId?`<div class="notice">Video sudah terhubung. Klik Cek status untuk membaca visibilitas dari YouTube.</div>`:'<div class="empty" style="margin-bottom:15px">Belum ada video terhubung. Upload manual dapat ditautkan di bawah.</div>');
 $('#manualYouTubeVideo').placeholder=c.youtubeVideoId||'Tempel tautan atau ID video pada channel yang terhubung';
 $('#manualYouTubeVideo').disabled=!!c.youtubeVideoId;
 $('#linkManualYouTube').disabled=!!hub.editing.isNew||reconnect;
 $('#linkManualYouTube').textContent=c.youtubeVideoId?'Cek status YouTube':'Hubungkan video manual';
 $('#prepareUpload').disabled=!!hub.editing.isNew||!!activeJob(c)||!!c.youtubeVideoId||c.archived||reconnect;
 $('#contentHistory').innerHTML=c.history.map(h=>`<div class="history-row"><div><strong>Versi ${h.revision}</strong><div class="hint">${dateWib(h.updatedAt)} · ${esc(h.title)}</div></div><button type="button" class="btn mini" data-restore="${h.revision}">Pulihkan</button></div>`).join('')||'<div class="empty">Riwayat muncul setelah konten diubah.</div>';
}
$('#contentPublication').onclick=async e=>{if(!e.target.closest('[data-content-retry]'))return;const j=linkedJob(hub.editing.content);try{await api('/api/jobs/'+j.id+'/retry',{method:'POST',body:'{}'});await refresh();toast('Antrean dilanjutkan dari file tersimpan.')}catch(err){toast(err.message)}};
$('#duplicateContent').onclick=async()=>{if(!await flushSave())return;try{const r=await api('/api/contents/'+hub.editing.content.id+'/duplicate',{method:'POST',body:'{}'});await closeEditor();await loadHub();await openContent(r.content.id)}catch(err){toast(err.message)}};
$('#archiveContent').onclick=async()=>{if(!await flushSave())return;hub.editing.content.archived=!hub.editing.content.archived;markDirty();if(await flushSave()){await closeEditor();toast('Status arsip diperbarui.')}};
$('#deleteContent').onclick=async()=>{if(!await flushSave())return;if(!confirm('Hapus konten beserta script dan riwayatnya secara permanen?'))return;try{await api('/api/contents/'+hub.editing.content.id,{method:'DELETE',body:JSON.stringify({revision:hub.editing.content.revision})});hub.editing=null;$('#contentEditor').close();await loadHub();toast('Konten dihapus.')}catch(err){toast(err.message)}};
$('#prepareUpload').onclick=async()=>{if(!await flushSave())return;if(state.files.length>1)return toast('Kosongkan pilihan video terlebih dahulu. Satu konten dihubungkan dengan satu video.');const c=hub.editing.content;if(c.youtubeVideoId)return toast('Konten sudah terhubung ke video YouTube. Duplikasikan untuk produksi video baru.');state.linkedContentId=c.id;state.linkedContent=c;$('#description').value=c.description;$('#tags').value=c.tags;if(c.plannedPublishAt)$('#startAt').value=localInput(new Date(c.plannedPublishAt));for(const x of state.files){x.contentId=c.id;x.videoFormat=c.format;x.title=c.title.slice(0,100);x.autoTitle=false}autoSchedule();renderFiles();$('#linkedUploadText').textContent='Video untuk: '+c.title;$('#linkedUpload').classList.remove('hide');await closeEditor();navigate('upload')};
$('#clearUploadLink').onclick=()=>{state.linkedContentId=null;state.linkedContent=null;for(const x of state.files)x.contentId=null;$('#linkedUpload').classList.add('hide')};

$('#copyDraft').onclick=async()=>{if(!hub.editing)return;try{const fields=readForm();fields.title=(fields.title+' (draft)');fields.archived=false;const r=await api('/api/contents',{method:'POST',body:JSON.stringify(fields)});clearTimeout(hub.timer);clearLocalDraft(hub.editing.content.id);hub.editing=null;$('#contentEditor').close();await loadHub();await openContent(r.content.id);toast('Draft disimpan sebagai konten baru.')}catch(err){toast(err.message)}};

const requestedView=new URLSearchParams(location.search).get('view');if(requestedView&&(VIEW_TEXT[requestedView]||requestedView==='upload'))navigate(requestedView);
restoreHubCache();

let jobFormatEditing=null,jobFormatSaving=false;
function openJobFormat(id){const job=state.server?.jobs.find(j=>j.id===id);if(!job)return;jobFormatEditing={id,videoFormat:job.videoFormat||''};$('#jobFormatTitle').textContent=job.title;$('#jobFormat').value=jobFormatEditing.videoFormat;$('#jobFormatError').classList.add('hide');$('#jobFormatDialog').showModal()}
$('#closeJobFormat').onclick=()=>{if(!jobFormatSaving)$('#jobFormatDialog').close()};
$('#jobFormatDialog').addEventListener('cancel',e=>{if(jobFormatSaving)e.preventDefault()});
$('#jobFormatForm').onsubmit=async e=>{e.preventDefault();if(!jobFormatEditing||jobFormatSaving)return;jobFormatSaving=true;$('#saveJobFormat').disabled=true;$('#jobFormatError').classList.add('hide');try{const r=await api('/api/jobs/'+jobFormatEditing.id+'/format',{method:'PATCH',body:JSON.stringify({videoFormat:$('#jobFormat').value,previousFormat:jobFormatEditing.videoFormat})});state.server.jobs=state.server.jobs.map(j=>j.id===r.job.id?r.job:j);$('#jobFormatDialog').close();renderHub();toast('Kategori video disimpan.')}catch(err){$('#jobFormatError').textContent=err.message;$('#jobFormatError').classList.remove('hide')}finally{jobFormatSaving=false;$('#saveJobFormat').disabled=false}};
