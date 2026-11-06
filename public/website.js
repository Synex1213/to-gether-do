'use strict';
(() => {
  const THEMES = [['blue','莫兰迪蓝','#8da6b8'],['purple','莫兰迪紫','#aa9bb8'],['green','莫兰迪绿','#88a294'],['yellow','莫兰迪黄','#c2b085'],['pink','莫兰迪粉','#c19daa'],['black','标准黑','#29313e'],['white','标准白','#fff']];
  const FEATURES = {
    status:{number:'01',title:'各自专注，\n也有陪伴。',copy:'分享手上的事，伙伴的小窗里就会看见。也可以右键自己的状态，快速切换。'},
    tasks:{number:'02',title:'各有安排，\n也为你加油。',copy:'试着添加一件小事，勾选完成，或者回应伙伴的计划。演示内容只保留在当前页面。'},
    play:{number:'03',title:'留一点轻松，\n一起歇歇脚。',copy:'这个示例里，伙伴正在摸鱼。试试轻松抓包，或给自己切换一下状态。'},
    settings:{number:'04',title:'你的桌面，\n你喜欢的样子。',copy:'换一个主题，选好状态有效期。也可以预览到期后的显示，体验小窗的分寸感。'}
  };
  const ACTIVITIES = [['study','学习'],['work','工作'],['eat','吃饭'],['idle','休息'],['sleep','睡觉'],['commute','通勤']];
  const today = () => new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const initial = () => ({theme:'green',feature:'status',expanded:true,quick:null,activity:'复习第三章',activityKey:'study',focus:'focusing',mood:'normal',expired:false,duration:0,statusDraft:'',taskDraft:'',date:today(),tasks:[{id:1,text:'读完今天的章节',done:true},{id:2,text:'整理课堂笔记',done:false}],nextId:3,replied:false,partnerFocus:'focusing',catchCount:0,pinned:true,locked:false,snap:true,help:false});
  let state = initial();
  let toastTimer;
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rootFor = id => document.querySelector(`[data-widget="${id}"]`);
  const notify = message => { const el=document.getElementById('demo-toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600); };
  const themeButtons = () => THEMES.map(([key,label,color])=>`<button type="button" data-theme-key="${key}" style="--swatch:${color}" aria-label="${label}" title="${label}" aria-pressed="${state.theme===key}"></button>`).join('');
  const focusLabel = key => ({available:'🟢 可打扰',focusing:'🎯 专注中',slacking:'🐟 摸鱼中'})[key];
  function person(mine) {
    const activity=mine?state.activity:'写一份报告';
    return `<button type="button" class="demo-person" data-person="${mine?'mine':'partner'}" data-action="${mine?'open-status':'open-tasks'}" aria-label="${mine?'阿然（我）':'小林'}的演示状态" title="${mine?'点击改状态；右键可快速切换':'点击看演示计划'}"><span class="demo-avatar" aria-hidden="true">${mine?'然':'林'}</span><span class="demo-person-summary"><span class="demo-person-top"><span class="demo-person-name">${mine?'阿然 · 我':'小林'}</span><span class="demo-online" aria-hidden="true"></span><span class="demo-person-time">${mine&&state.expired?'已到期':'刚刚'}</span></span><span class="demo-person-activity">${mine&&state.expired?'待更新 · ':''}${escape(activity)}</span>${mine&&state.expired?'':`<span class="demo-focus-label">${focusLabel(mine?state.focus:state.partnerFocus)}</span>`}</span></button>`;
  }
  function statusPanel() {
    return `<section class="demo-card"><div class="demo-card-title">我的状态<button type="button" class="demo-btn demo-btn-ghost" data-action="rest">休息一下</button></div><form class="demo-form" data-form="status"><input class="demo-input" aria-label="演示当前事项" name="activity" maxlength="100" placeholder="此刻在做什么…" value="${escape(state.statusDraft)}"><button class="demo-btn">分享</button></form><div class="demo-chips">${[['available','🟢 可打扰'],['focusing','🎯 专注中'],['slacking','🐟 摸鱼中']].map(([key,label])=>`<button type="button" class="demo-chip ${state.focus===key?'active':''}" data-focus="${key}">${label}</button>`).join('')}</div><div class="demo-chips">${ACTIVITIES.map(([key,label])=>`<button type="button" class="demo-chip ${state.activityKey===key?'active':''}" data-activity="${key}">${label}</button>`).join('')}</div><div class="demo-chips">${[['normal','😐 平常'],['happy','😊 开心'],['tired','😴 有点累'],['missyou','🙂 想聊聊']].map(([key,label])=>`<button type="button" class="demo-chip ${state.mood===key?'active':''}" data-mood="${key}">${label}</button>`).join('')}</div></section>`;
  }
  function taskPanel() {
    return `<section class="demo-card"><div class="demo-card-title">我的计划 <span>${state.tasks.filter(t=>t.done).length}/${state.tasks.length}</span></div><form class="demo-form" data-form="task"><input class="demo-input" aria-label="演示添加任务" name="task" maxlength="100" placeholder="给自己加一件事…" value="${escape(state.taskDraft)}"><button class="demo-btn">添加</button></form><p class="demo-muted">${state.date===today()?'今天':escape(state.date)} · 示例计划</p>${state.tasks.map(t=>`<div class="demo-task ${t.done?'done':''}"><button type="button" data-task="${t.id}" aria-label="${t.done?'取消完成':'完成任务'}：${escape(t.text)}">${t.done?'✓':''}</button><span>${escape(t.text)}</span></div>`).join('')}</section><section class="demo-card"><div class="demo-card-title">伙伴的计划</div><div class="demo-task"><span>把报告的初稿写完</span><button type="button" class="demo-btn demo-btn-ghost" data-action="reply">💪 回应</button></div>${state.replied?'<p class="demo-reply">💪 一起加油！（示例回应）</p>':''}</section>`;
  }
  function playPanel() {
    return `<section class="demo-card"><div class="demo-card-title">摸鱼与抓包</div><div class="demo-slack-actions"><button type="button" class="demo-btn demo-btn-ghost" data-action="slack">${state.focus==='slacking'?'结束摸鱼':'摸个鱼 🐟'}</button><button type="button" class="demo-btn demo-btn-ghost" data-action="catch" ${state.partnerFocus==='slacking'?'':'disabled'}>抓个正着</button></div><p class="demo-muted">${state.partnerFocus==='slacking'?'示例伙伴正在摸鱼，可以试试抓包。':'抓到了！示例伙伴已经结束摸鱼。'}</p><div class="demo-stats"><div><strong>0</strong>我被抓</div><div><strong>${state.catchCount}</strong>伙伴被抓</div></div></section>`;
  }
  function settingsPanel() {
    return `<section class="demo-card"><div class="demo-card-title">小窗设置</div>${[['pinned','始终置顶'],['snap','靠近边缘自动吸附'],['locked','锁定窗口位置']].map(([key,label])=>`<label class="demo-setting">${label}<input type="checkbox" data-setting="${key}" ${state[key]?'checked':''}></label>`).join('')}<label class="demo-setting">默认状态有效期<select data-setting="duration" aria-label="演示状态有效期">${[[0,'不限时间'],[30,'30 分钟'],[60,'1 小时'],[120,'2 小时']].map(([n,label])=>`<option value="${n}" ${state.duration===n?'selected':''}>${label}</option>`).join('')}</select></label><p class="demo-muted">系统窗口设置在本页仅作演示，不会改变你的浏览器。</p><button type="button" class="demo-btn demo-btn-ghost" data-action="expire">演示“待更新”效果</button><button type="button" class="demo-btn demo-btn-ghost" data-action="help" style="margin-top:7px">操作提示</button>${state.help?'<p class="demo-help">点自己改状态，点伙伴看计划。右键自己快速切换；桌面版关闭后仍可从托盘打开。</p>':''}</section>`;
  }
  function renderWidget(id) {
    const hero=id==='hero';const compact=hero||!state.expanded;
    const panel=state.feature==='tasks'?taskPanel():state.feature==='play'?playPanel():state.feature==='settings'?settingsPanel():statusPanel();
    rootFor(id).innerHTML=`<div class="product-widget ${compact?'compact':''}" data-theme="${state.theme}"><div class="widget-title"><span class="widget-brand"><img src="/icon.png" alt="">伙伴打卡</span><div class="widget-buttons"><button type="button" data-action="pin" aria-label="演示切换置顶" aria-pressed="${state.pinned}">置顶</button><button type="button" data-action="expand" aria-expanded="${!compact}" title="${hero?'在下方展开产品演示':'展开或收起演示小窗'}">${compact?'展开':'收起'}</button></div></div><div class="widget-content">${person(false)}${person(true)}${compact?'':`<nav class="widget-tabs" aria-label="演示小窗详情">${[['status','状态'],['tasks','计划'],['play','互动'],['settings','设置']].map(([key,label])=>`<button type="button" data-feature="${key}" class="${state.feature===key?'active':''}" aria-pressed="${state.feature===key}">${label}</button>`).join('')}</nav>${panel}`}</div><div class="widget-footer"><input type="date" value="${state.date}" max="${today()}" aria-label="${hero?'首屏':'功能'}演示计划日期" data-demo-date><div class="widget-themes" role="group" aria-label="小窗演示配色">${themeButtons()}</div></div>${state.quick===id?`<div class="demo-quick" role="dialog" aria-label="演示快速改状态"><div class="demo-quick-title">快速改状态<button type="button" data-action="close-quick" aria-label="关闭演示菜单">×</button></div><div class="demo-quick-grid">${ACTIVITIES.map(([key,label])=>`<button type="button" class="demo-btn demo-btn-ghost" data-activity="${key}">${label}</button>`).join('')}</div><p>这是产品演示，切换后仅更新此处示例。</p></div>`:''}</div>`;
  }
  function render() {
    renderWidget('hero');renderWidget('demo');
    const feature=FEATURES[state.feature];
    document.querySelector('.side-note-number').textContent=`${feature.number} / 04`;
    document.getElementById('demo-note-title').innerHTML=feature.title.split('\n').map(escape).join('<br>');
    document.getElementById('demo-note-copy').textContent=feature.copy;
    document.getElementById('demo-panel').setAttribute('aria-labelledby','feature-'+state.feature);
    for(const tab of document.querySelectorAll('.feature-guide [data-feature]')){const selected=tab.dataset.feature===state.feature;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    document.getElementById('theme-palette').innerHTML=themeButtons().replaceAll('type="button"','type="button" class="palette-swatch"');
    document.getElementById('palette-current').textContent=THEMES.find(t=>t[0]===state.theme)[1];
  }
  function selectFeature(key) {
    if(!FEATURES[key])return;
    state.feature=key;state.expanded=true;state.quick=null;
    if(key==='play')state.partnerFocus='slacking';
    render();
  }
  function goToDemo(feature) {
    selectFeature(feature);
    document.getElementById('demo').scrollIntoView?.({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button){if(state.quick&&!event.target.closest('.demo-quick')){state.quick=null;render();}return;}
    const form=button.closest('[data-form]');
    if(form){event.preventDefault();submitDemoForm(form);return;}
    const widget=button.closest('[data-widget]')?.dataset.widget;
    if(button.dataset.feature){selectFeature(button.dataset.feature);return;}
    if(button.dataset.themeKey){if(THEMES.some(t=>t[0]===button.dataset.themeKey)){const group=widget?`[data-widget="${widget}"]`:'#theme-palette';state.theme=button.dataset.themeKey;render();document.querySelector(`${group} [data-theme-key="${state.theme}"]`)?.focus({preventScroll:true});}return;}
    if(button.dataset.activity){state.activityKey=button.dataset.activity;state.activity=ACTIVITIES.find(a=>a[0]===state.activityKey)[1];state.focus=['study','work'].includes(state.activityKey)?'focusing':'available';state.expired=false;state.quick=null;render();notify('已切换示例状态，没有发送真实数据');return;}
    if(button.dataset.focus){state.focus=button.dataset.focus;state.expired=false;render();return;}
    if(button.dataset.mood){state.mood=button.dataset.mood;render();return;}
    if(button.dataset.task){const task=state.tasks.find(t=>String(t.id)===button.dataset.task);if(task)task.done=!task.done;render();return;}
    if(button.id==='demo-reset'){state=initial();render();notify('已重置演示');return;}
    switch(button.dataset.action){
      case 'open-status':widget==='hero'?goToDemo('status'):selectFeature('status');break;
      case 'open-tasks':widget==='hero'?goToDemo('tasks'):selectFeature('tasks');break;
      case 'expand':if(widget==='hero')goToDemo(state.feature);else{state.expanded=!state.expanded;state.quick=null;render();}break;
      case 'pin':state.pinned=!state.pinned;render();notify('置顶效果仅作演示，桌面版可置顶到其他窗口上方');break;
      case 'rest':state.activity='休息一下';state.activityKey='idle';state.focus='available';state.expired=false;render();break;
      case 'reply':state.replied=true;render();notify('示例回应已显示，不会发送给任何人');break;
      case 'slack':state.focus=state.focus==='slacking'?'available':'slacking';state.expired=false;render();break;
      case 'catch':if(state.partnerFocus==='slacking'){state.catchCount++;state.partnerFocus='available';render();notify('抓到了！这是一场轻松的示例互动');}break;
      case 'expire':state.expired=true;render();notify('到期后保留上次事项，显示“待更新”');break;
      case 'help':state.help=!state.help;render();break;
      case 'close-quick':state.quick=null;render();break;
    }
  });
  document.addEventListener('input',event=>{if(event.target.name==='activity')state.statusDraft=event.target.value;if(event.target.name==='task')state.taskDraft=event.target.value;});
  function submitDemoForm(form){
    const input=form.querySelector('input');const value=input.value.trim();if(!value){notify('写一件此刻想做的事吧');return;}
    if(form.dataset.form==='status'){state.activity=value.slice(0,100);state.statusDraft='';state.expired=false;notify('已更新示例状态，仅在当前页面可见');}
    else{if(state.tasks.length>=8){notify('演示最多添加 8 件小事，试试勾选已有计划吧');return;}state.tasks.push({id:state.nextId++,text:value.slice(0,100),done:false});state.taskDraft='';}
    render();
  }
  document.addEventListener('submit',event=>{const form=event.target.closest('[data-form]');if(form){event.preventDefault();submitDemoForm(form);}});
  document.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-demo-date')){
      const value=event.target.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>today()){render();return;}
      state.date=value;if(event.target.closest('[data-widget]')?.dataset.widget==='hero')goToDemo('tasks');else selectFeature('tasks');return;
    }
    const key=event.target.dataset.setting;
    if(['pinned','snap','locked'].includes(key)){state[key]=event.target.checked;render();notify('此处为效果演示，系统功能在桌面版生效');}
    if(key==='duration'){state.duration=Number(event.target.value);notify('已调整演示时长，可点击下方按钮预览到期效果');}
  });
  document.addEventListener('contextmenu',event=>{
    if(!event.target.closest('[data-person="mine"]'))return;event.preventDefault();state.quick=event.target.closest('[data-widget]').dataset.widget;render();rootFor(state.quick).querySelector('.demo-quick [data-activity]')?.focus();
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('.feature-guide [role="tab"]');
    if(tab&&['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key)){
      event.preventDefault();const tabs=[...document.querySelectorAll('.feature-guide [role="tab"]')];let i=tabs.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:tabs.length-1))%tabs.length;selectFeature(tabs[i].dataset.feature);tabs[i].focus();
    }
    if(event.key==='Escape'&&state.quick){const id=state.quick;state.quick=null;render();rootFor(id).querySelector('[data-person="mine"]')?.focus();}
    if((event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)&&event.target.matches('[data-person="mine"]')){event.preventDefault();state.quick=event.target.closest('[data-widget]').dataset.widget;render();rootFor(state.quick).querySelector('.demo-quick [data-activity]')?.focus();}
  });
  render();document.getElementById('year').textContent=new Date().getFullYear();
  fetch('/api/release').then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json();}).then(release=>{
    if(!/^\d+\.\d+\.\d+$/.test(release.version))return;
    document.querySelectorAll('[data-release-version]').forEach(el=>el.textContent='v'+release.version);
    if(Number.isFinite(release.size)&&release.size>0)document.querySelectorAll('[data-release-size]').forEach(el=>el.textContent=`约 ${Math.round(release.size/1000000)} MB`);
  }).catch(()=>{});
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('pending');observer.unobserve(entry.target);}}),{threshold:.08});for(const el of document.querySelectorAll('.section-heading,.quiet-layout,.start-steps,.download-section')){el.classList.add('reveal','pending');observer.observe(el);}}
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();
