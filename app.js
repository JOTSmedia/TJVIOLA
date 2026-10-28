import './atmosphere.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let content = { releases: [], videos: [] };
let introController;
let selectedTrack = -1;
let toastTimer;
const audio = new Audio();
audio.preload = 'none';
const formatTime = time => `${Math.floor((Number.isFinite(time) ? time : 0)/60)}:${String(Math.floor((Number.isFinite(time) ? time : 0)%60)).padStart(2,'0')}`;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 5500); }
const contentReady = fetch('./content.json').then(r => {if(!r.ok) throw new Error('Content unavailable');return r.json();}).then(data => {content=data;renderReleases();renderVideos();}).catch(() => {$('#releases').innerHTML='<p>The music is always on. <a class="text-link" href="https://open.spotify.com/artist/2A7bEP5LqBuB7lufyKeQNS" target="_blank" rel="noopener noreferrer">Listen on Spotify ↗</a></p>';$('#video-grid').innerHTML='<a class="text-link" href="https://www.youtube.com/channel/UCdoKfFgpne1dtGjdV7HknIg" target="_blank" rel="noopener noreferrer">Explore TJ’s YouTube channel</a>';});

function renderReleases() {
  $('#releases').innerHTML = content.releases.map((track,index) => `<article class="release reveal"><div class="cover-stage"><button class="cover-button" data-preview="${index}" aria-label="Play 30-second preview of ${escapeHTML(track.title)}"><img src="./assets/${track.slug}.jpg" srcset="./assets/${track.slug}-640.jpg 640w, ./assets/${track.slug}-1280.jpg 1280w, ./assets/${track.slug}.jpg ${[2048,2181,3000,1400][index]}w" sizes="(max-width: 1000px) 44vw, 28vw" width="700" height="700" alt="${escapeHTML(track.title)} single artwork" loading="lazy"><span class="cover-play">${icon('play')}</span></button></div><div class="release-meta"><div><h3>${escapeHTML(track.title)}</h3><p>${index===3?'TJ Viola & Jack Cunningham':'TJ Viola'}</p></div><a href="${escapeHTML(track.spotify_url)}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${escapeHTML(track.title)} on Spotify">${icon('arrow')}</a></div><div class="release-duration"><span>${formatTime(track.spotify_duration_ms/1000 || track.duration_seconds)} · Single</span><span>Preview ${icon('play')}</span></div></article>`).join('');
  observeReveals();
}
const videoCategory = video => /live|highlight reel/i.test(video.title)?'Live performance':/official|TJ Viola & Jack Cunningham/i.test(video.title)?'Original music':/rig|tutorial/i.test(video.title)?'Behind the sound':'At the keys';
let videoFilter = 'selected', videoLimit = 6;
const selectedIDs = ['PhwTiopf_yM','PDmBNIOHTFE','4Ubav874--w'];
function filteredVideos() {
  if(videoFilter==='selected') return selectedIDs.map(id=>content.videos.find(v=>v.id===id)).filter(Boolean);
  if(videoFilter==='live') return content.videos.filter(v=>videoCategory(v)==='Live performance');
  if(videoFilter==='original') return content.videos.filter(v=>videoCategory(v)==='Original music');
  return content.videos;
}
function cleanTitle(title) {if(/Rig Build Tutorial/i.test(title))return 'Building the live rig';if(/instructional drum video/i.test(title))return 'An ’80s drum moment';if(/harmonies so absurd/i.test(title))return 'A few unexpected harmonies';if(/fireflies challenge/i.test(title))return 'Fireflies, with extra harmony';if(/Human Nature LIVE @ The Whisky/i.test(title))return 'Human Nature at the Whisky';if(/TJ Viola LIVE at The Whisky/i.test(title))return 'Live at the Whisky A Go Go';if(/TJ Viola LIVE @ The Delancey/i.test(title))return 'Live at The Delancey';return title.replace(/^TJ Viola(?: & Jack Cunningham)?\s*[-–]\s*/,'').replace(/\s*\((?:OFFICIAL|Official) (?:MUSIC VIDEO|LYRIC VIDEO|Audio)\)/g,'').replace(/\s*#.*$/,'').replace(/\s*\(Michael Jackson Cover\)|\s*\(Lizzy McAlpine Cover\)/ig,'');}
function renderVideos() {
  const videos = filteredVideos();
  $('#video-grid').innerHTML=videos.slice(0,videoLimit).map(v=>`<article class="video-tile"><button data-video="${v.id}" data-title="${escapeHTML(v.title)}" aria-label="Watch ${escapeHTML(v.title)}"><img src="./assets/video-${v.id}.jpg" width="480" height="360" alt="${escapeHTML(cleanTitle(v.title))} video still" loading="lazy"><span class="cover-play">${icon('play')}</span><span class="film-length">${v.duration}</span></button><h3>${escapeHTML(cleanTitle(v.title))}</h3><p>${videoCategory(v)}</p></article>`).join('');
  $('#more-videos').hidden = videos.length <= videoLimit;
}
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{videoFilter=button.dataset.filter;videoLimit=6;$$('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderVideos();}));
$('#more-videos').addEventListener('click',()=>{videoLimit+=6;renderVideos();});

function setPlayerState(playing) {
  $('#player-play').innerHTML=icon(playing?'pause':'play');$('#player-play').setAttribute('aria-label',playing?'Pause preview':'Play preview');
  $$('.cover-button').forEach((button,i)=>{const active=playing && i===selectedTrack;button.setAttribute('aria-label',`${active?'Pause':'Play 30-second preview of'} ${content.releases[i]?.title||''}`);$('.cover-play',button).innerHTML=icon(active?'pause':'play');});
}
async function preview(index) {
  await contentReady;
  closeSpotify();
  const track=content.releases[index];if(!track) return;
  if(index===selectedTrack && !audio.paused){audio.pause();return;}
  $('#audio-player').hidden=false;document.body.classList.add('has-player');
  if(index!==selectedTrack){selectedTrack=index;audio.src=track.spotify_audio_preview_url;$('#player-art').src=`./assets/${track.slug}-640.jpg`;$('#player-art').alt=`${track.title} artwork`;$('#player-title').textContent=track.title;$('#player-spotify').href=track.spotify_url;$('#audio-seek').value=0;$('#player-time').textContent='0:00 / 0:30';}
  try{await audio.play();}catch{setPlayerState(false);toast('Preview unavailable. Use “Full track” to listen on Spotify.');}
}
audio.addEventListener('play',()=>setPlayerState(true));audio.addEventListener('pause',()=>setPlayerState(false));audio.addEventListener('ended',()=>setPlayerState(false));
audio.addEventListener('error',()=>{setPlayerState(false);if(selectedTrack>=0)toast('Preview unavailable. The full track is available on Spotify.');});
audio.addEventListener('loadedmetadata',()=>$('#audio-seek').max=String(audio.duration||30));
audio.addEventListener('timeupdate',()=>{$('#audio-seek').value=audio.currentTime;$('#player-time').textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration||30)}`;});
$('#audio-seek').addEventListener('input',event=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value);});
$('#player-play').addEventListener('click',()=>{if(audio.paused)preview(Math.max(0,selectedTrack));else audio.pause();});
$('#player-next').addEventListener('click',()=>preview((selectedTrack+1)%content.releases.length));
$('#player-close').addEventListener('click',()=>{audio.pause();$('#audio-player').hidden=true;document.body.classList.remove('has-player');});
function closeSpotify(){const panel=$('#spotify-inline');if(panel.hidden)return;panel.hidden=true;$('iframe',panel).removeAttribute('src');$('#show-spotify').setAttribute('aria-expanded','false');$('#show-spotify').innerHTML=`Listen on Spotify ${icon('arrow-right')}`;}
$('#show-spotify').addEventListener('click',()=>{const panel=$('#spotify-inline');if(!panel.hidden){closeSpotify();return;}panel.hidden=false;$('#show-spotify').setAttribute('aria-expanded',String(!panel.hidden));$('#show-spotify').innerHTML=`${panel.hidden?'Listen on Spotify':'Close Spotify player'} ${icon(panel.hidden?'arrow-right':'close')}`;if(!panel.hidden){audio.pause();if(!$('iframe',panel).src)$('iframe',panel).src='https://open.spotify.com/embed/artist/2A7bEP5LqBuB7lufyKeQNS?utm_source=generator&theme=0';setTimeout(()=>panel.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'center'}),100);}});

let lastVideoTrigger;
function openVideo(id,title,trigger) {
  audio.pause();closeSpotify();lastVideoTrigger=trigger;
  $('#video-title').textContent=title;$('#video-fallback').href=`https://www.youtube.com/watch?v=${id}`;
  const frame=document.createElement('iframe');frame.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;frame.title=title;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;
  $('#video-embed').replaceChildren(frame);$('#video-dialog').showModal();
}
function closeVideo(){$('#video-dialog').close();}
$('#video-dialog').addEventListener('close',()=>{$('#video-embed').replaceChildren();lastVideoTrigger?.focus({preventScroll:true});});
$('[data-close-dialog]').addEventListener('click',closeVideo);
$('#video-dialog').addEventListener('click',event=>{if(event.target===$('#video-dialog')){const bounds=event.target.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeVideo();}});
$('#open-credits').addEventListener('click',()=>$('#credits-dialog').showModal());$('[data-close-credits]').addEventListener('click',()=>$('#credits-dialog').close());
document.addEventListener('click',event=>{const previewButton=event.target.closest('[data-preview]');if(previewButton)preview(Number(previewButton.dataset.preview));const videoButton=event.target.closest('[data-video]');if(videoButton)openVideo(videoButton.dataset.video,videoButton.dataset.title,videoButton);});
const menuButton=$('#menu-toggle'), mobileNav=$('#mobile-nav');
function closeMenu(){mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');}
menuButton.addEventListener('click',()=>{const open=mobileNav.hidden;mobileNav.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
$$('a',mobileNav).forEach(link=>link.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
matchMedia('(min-width:601px)').addEventListener('change',event=>{if(event.matches)closeMenu();});

// Content stays visible without JavaScript; observation adds motion only after boot.
let revealObserver;
function observeReveals(){
  if(reducedMotion||!('IntersectionObserver' in window))return;
  revealObserver ||= new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('is-pending');entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}),{threshold:.12,rootMargin:'0px 0px -20px 0px'});
  $$('.reveal:not([data-observed])').forEach((el,index)=>{el.dataset.observed='true';el.classList.add('is-pending');el.style.transitionDelay=`${index%3*60}ms`;revealObserver.observe(el);});
}
document.documentElement.classList.add('motion-ready');observeReveals();
const sections=$$('main>section[id]');if('IntersectionObserver' in window){const navObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)$$('.desktop-nav a').forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`));}),{rootMargin:'-20% 0px -50% 0px'});sections.forEach(section=>navObserver.observe(section));}
let scrollFrame=0;
if(!reducedMotion){window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{const y=window.scrollY;const hero=$('.hero-photo-media>img');if(innerWidth>600 && y<innerHeight*1.7)hero.style.transform=`translateY(calc(-6% + ${Math.min(y*.11,95)}px))`;scrollFrame=0;});},{passive:true});}
$('#year').textContent=new Date().getFullYear();

async function startIntro(replay=false) {
  introController?.finish();
  clearTimeout(window.introFailsafe);
  const controller={active:true,keyboard:null,frame:0,finish};introController=controller;
  document.documentElement.classList.remove('is-ready');document.body.classList.add('intro-active');
  for(const el of [$('.site-header'),$('main'),$('.footer')])el.inert=true;
  $('#load-percent').textContent='0';$('.progress-fill').style.width='0%';$('.progress-track').setAttribute('aria-valuenow','0');$('#load-status').textContent='Setting the tone';
  let loaded=0,total=7,progress=0,assetsDone=false,sweepStartedAt=null;const begin=performance.now();
  const assetSettled=()=>loaded++;
  const assets=[document.fonts.ready,contentReady,...['artist-live','running','ghostin','confessions'].map(name=>new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.sizes=name==='artist-live'?'100vw':'(max-width: 1000px) 44vw, 28vw';image.srcset=`./assets/${name}-640.jpg 640w, ./assets/${name}-1280.jpg 1280w, ./assets/${name}.jpg ${name==='artist-live'?3700:({running:2048,ghostin:2181,confessions:3000}[name])}w`;image.src=`./assets/${name}.jpg`;}))];
  const keyboardTask=import('./keyboard.js').then(async({createKeyboard})=>{if(!controller.active)return;controller.keyboard=createKeyboard($('#loader-keyboard'),{interactive:false,compact:true});await controller.keyboard.ready;}).finally(()=>{if(sweepStartedAt===null)sweepStartedAt=performance.now();});
  Promise.allSettled([...assets,keyboardTask].map(p=>p.finally(assetSettled))).then(()=>assetsDone=true);
  const emergency=setTimeout(()=>{assetsDone=true;loaded=total;if(sweepStartedAt===null)sweepStartedAt=begin;},9000);
  function finish(){if(!controller.active)return;controller.active=false;cancelAnimationFrame(controller.frame);clearTimeout(emergency);setTimeout(()=>{controller.keyboard?.dispose();},reducedMotion?0:950);document.documentElement.classList.add('is-ready');document.body.classList.remove('intro-active');for(const el of [$('.site-header'),$('main'),$('.footer')])el.inert=false;}
  function tick(now){if(!controller.active)return;const elapsed=sweepStartedAt===null?0:now-sweepStartedAt;const minDuration=reducedMotion?700:5800;const target=assetsDone?100:Math.min(92,10+loaded/total*82);const paced=Math.min(target,elapsed/minDuration*100);progress=sweepStartedAt===null?0:Math.min(100,progress+Math.max(.04,(paced-progress)*.15));const percent=Math.min(100,Math.floor(progress));$('#load-percent').textContent=String(percent);$('.progress-fill').style.width=`${progress}%`;$('.progress-track').setAttribute('aria-valuenow',String(percent));controller.keyboard?.setProgress(progress);$('#load-status').textContent=percent<30?'Setting the tone':percent<70?'Building the sound':percent<100?'Nearly there':'Welcome in';if(assetsDone && progress>99.6 && elapsed>=minDuration){$('#load-percent').textContent='100';$('.progress-fill').style.width='100%';$('.progress-track').setAttribute('aria-valuenow','100');controller.keyboard?.setProgress(100);$('#load-status').textContent='Welcome in';setTimeout(finish,reducedMotion?80:600);return;}controller.frame=requestAnimationFrame(tick);}
  controller.frame=requestAnimationFrame(tick);
  if(replay){audio.pause();closeSpotify();window.scrollTo({top:0,behavior:'instant'});$('#skip-intro').focus({preventScroll:true});}
}
$('#skip-intro').addEventListener('click',()=>introController?.finish());
$('#replay-intro').addEventListener('click',()=>startIntro(true));
startIntro();
