(function(){
  'use strict';

  var CATEGORY_LABELS = {
    random: "Random — pick a realistic Wyze support scenario",
    connectivity: "Device offline or won't connect to Wi-Fi",
    account: "App or account login trouble",
    footage: "Missing footage or cloud storage confusion",
    hardware: "Hardware malfunction (battery, audio, video quality)",
    shipping: "Shipping or delivery delay",
    rma: "Damaged or defective item — replacement / RMA request",
    billing: "Billing or Cam Plus subscription dispute",
    privacy: "Privacy or security concern (unexpected access, odd notifications)",
    howto: "Feature confusion — customer isn't sure how to do something",
    motion: "Motion detection or event clips not triggering when they should",
    sd: "SD card won't be recognized, or recorded video won't play back",
    battery: "Wireless camera battery draining too fast or not charging with a setup issue",
    view: "The live view is black, frozen, or keeps buffering",
    audio: "Two-way audio — the speaker or microphone isn't working",
    notify: "Push notifications for events aren't arriving (or are showing too many)",
    night: "Night vision or overall image quality looks dark, grainy, or washed out",
    home: "Smart-home integration issue — routines, Alexa, or Google Assistant won't work"
  };
  var EMOTION_LABELS = {
    random: "Random — pick a fitting emotional tone",
    calm: "Calm and neutral",
    annoyed: "Mildly annoyed",
    frustrated: "Frustrated",
    upset: "Very upset, ready to escalate",
    anxious: "Anxious or worried",
    confused: "Confused, low technical confidence"
  };

  var WYZE_CATALOG = [
    "Indoor cameras: Wyze Cam v3, Wyze Cam v3 Pro, Wyze Cam v2, Wyze Cam OG (incl. Telephoto), Wyze Cam Pan v2, Wyze Cam Indoor",
    "Battery / outdoor cameras: Wyze Cam Outdoor v2, Wyze Cam Outdoor v1, Wyze Battery Cam Pro, Wyze Cam Floodlight",
    "Video doorbells: Wyze Video Doorbell v2, Wyze Video Doorbell Pro, Wyze Video Doorbell v1 (battery/wired)",
    "Home security & locks: Wyze Sense v2 kit (entry/motion sensors + hub), Wyze Lock, Wyze Lock Bolt, Wyze Smart Lock, Wyze Siren",
    "Smart home & lighting: Wyze Bulb Color, Wyze Bulb White, Wyze Light Strip, Wyze Plug, Wyze Plug Outdoor",
    "Climate & sensors: Wyze Thermostat, Wyze Sense Thermostat, Wyze Temp/Humidity Sensor, Wyze Leak/Water sensor",
    "Robotics & wellness: Wyze Robot Vacuum, Wyze Robot Vacuum v2, Wyze Scale, Wyze Buds, Wyze Headphones",
    "Smartphones & accessories: Wyze Cam cases/mounts, Wyze rechargeable batteries, Wyze Power Adapter (make sure each is plausibly connected to the scenario)"
  ].join('\n');

  function usedProductsLabel(){
    var used = readLS('used-products') || [];
    if(used.length === 0) return 'None yet in this practice session.';
    return used.map(function(u){ return u.product + ' (category: ' + u.category + ')'; }).join('; ');
  }
  function recordUsedProduct(persona){
    var used = readLS('used-products') || [];
    if(!persona || !persona.product) return;
    used = used.filter(function(u){ return u.product.toLowerCase() !== persona.product.toLowerCase(); });
    used.unshift({ product: persona.product, category: persona.issueCategory || '' });
    used = used.slice(0, 12);
    writeLS('used-products', used);
  }

  /* ---------- Session factory ---------- */
  function newSession(){
    return {
      sessionId: null,
      ticketId: null,
      createdAt: null,
      persona: null,
      messages: [],
      status: 'OPEN',
      busy: false,
      feedback: null,
      typeStart: null,
      ended: false,
      avgWpm: null,
      coachingPoints: null,
      traineeName: '',
      lob: '',
      notes: { fCustomerName:'', fEmail:'', fProduct:'', fRecap:'', fResources:'', fNextSteps:'', fEscalation:'' }
    };
  }

  var sessions = [newSession()];
  var activeIndex = 0;
  var state = sessions[0];
  var trainerMode = false;
  var twoChats = false;
  var timerOn = false;
  var caseOpen = false;

  function $(id){ return document.getElementById(id); }
  var chatLog = $('chatLog');
  var emptyState = $('emptyState');
  var agentInput = $('agentInput');
  var sendBtn = $('sendBtn');
  var chatForm = $('chatForm');
  var typingIndicator = $('typingIndicator');
  var ticketIdEl = $('ticketId');
  var statusPill = $('statusPill');
  var chatMeta = $('chatMeta');
  var speedBar = $('speedBar');
  var speedLive = $('speedLive');
  var speedAvg = $('speedAvg');
  var newScenarioBtn = $('newScenarioBtn');
  var feedbackBtn = $('feedbackBtn');
  var trainerModeToggle = $('trainerModeToggle');
  var twoChatsToggle = $('twoChatsToggle');
  var timerToggle = $('timerToggle');
  var answerKey = $('answerKey');
  var answerKeyContent = $('answerKeyContent');
  var feedbackBox = $('feedbackBox');
  var feedbackContent = $('feedbackContent');
  var saveIndicator = $('saveIndicator');
  var categorySelect = $('categorySelect');
  var emotionSelect = $('emotionSelect');
  var historyBtn = $('historyBtn');
  var historyModal = $('historyModal');
  var historyList = $('historyList');
  var infoBtn = $('infoBtn');
  var infoModal = $('infoModal');
  var errorBanner = $('errorBanner');
  var errorText = $('errorText');
  var retryBtn = $('retryBtn');
  var copyBtn = $('copyBtn');
  var caseBtn = $('caseBtn');
  var casePane = $('casePane');
  var closeCase = $('closeCase');
  var caseTabLabel = $('caseTabLabel');
  var chatTabs = $('chatTabs');
  var replyTimer = $('replyTimer');
  var replyTimerClock = $('replyTimerClock');
  var fTraineeName = $('fTraineeName');
  var fLob = $('fLob');
  var endBtn = $('endBtn');
  var avgWpmBox = $('avgWpmBox');
  var avgWpmVal = $('avgWpmVal');
  var coachingBox = $('coachingBox');
  var coachingContent = $('coachingContent');

  var caseFields = {
    fCustomerName: $('fCustomerName'),
    fEmail: $('fEmail'),
    fProduct: $('fProduct'),
    fRecap: $('fRecap'),
    fResources: $('fResources'),
    fNextSteps: $('fNextSteps'),
    fEscalation: $('fEscalation')
  };

  var lastFailedAction = null;

  var TIMER_WARN = 60;    // seconds in the yellow zone
  var TIMER_DANGER = 120; // seconds before it turns red

  function genId(prefix){
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }
  function genTicketId(){
    return 'WZ-' + Math.floor(100000 + Math.random()*899999);
  }
  function fmtTime(ts){
    return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }
  function escapeHtml(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function wpmFrom(charCount, startTs){
    var minutes = (Date.now() - startTs) / 60000;
    if(minutes <= 0.02) return null;
    var w = (charCount / 5) / minutes;
    if(w < 1 || w > 200) return null;
    return Math.round(w);
  }
  function uiSpeedWpm(){
    return state.typeStart && agentInput.value ? wpmFrom(agentInput.value.length, state.typeStart) : null;
  }
  function avgReplyWpm(){
    var wpms = (state.messages || []).filter(function(m){ return m.role === 'agent' && m.wpm; }).map(function(m){ return m.wpm; });
    if(wpms.length === 0) return null;
    return {
      avg: Math.round(wpms.reduce(function(a,b){ return a+b; }, 0) / wpms.length),
      count: wpms.length
    };
  }
  function updateSpeedUI(){
    var a = avgReplyWpm();
    var cur = uiSpeedWpm();
    if(cur){
      speedLive.innerHTML = 'Typing at <b>' + cur + ' WPM</b> right now';
    } else if(a){
      speedLive.innerHTML = 'Type a reply to measure another speed';
    } else if(state.persona){
      speedLive.textContent = 'Start typing your reply to measure your speed';
    } else {
      speedLive.textContent = 'Start a customer to begin';
    }
    speedAvg.textContent = a ? 'Session avg <b>' + a.avg + ' WPM</b> across ' + a.count + ' reply' + (a.count > 1 ? 's' : '') : '';
  }
  function guessEmotionColor(str){
    var s = (str || '').toLowerCase();
    if(/upset|angry|escalat|furious/.test(s)) return 'coral';
    if(/frustrat|annoy|impatient/.test(s)) return 'amber';
    if(/anxious|worried|confus|nervous/.test(s)) return 'blue';
    if(/calm|neutral|patient/.test(s)) return 'teal';
    return 'muted';
  }

  async function runModel(messages, opts){
    opts = opts || {};
    try {
      var completion = await websim.chat.completions.create({
        messages: messages,
        schema: opts.schema,
        json: opts.json
      });
      return completion.content;
    } catch(e){
      throw new Error("Couldn't reach the simulator model — try again.");
    }
  }

  function anyBusy(){
    return sessions.some(function(s){ return s.busy; });
  }
  function refreshControls(){
    newScenarioBtn.disabled = state.busy;
    categorySelect.disabled = state.busy;
    emotionSelect.disabled = state.busy;
    sendBtn.disabled = state.busy || !state.persona || state.ended;
    agentInput.disabled = state.busy || !state.persona || state.ended;
    feedbackBtn.disabled = state.busy || !state.persona || state.messages.length < 2;
    endBtn.disabled = state.busy || !state.persona || state.ended || state.messages.length < 2;
    typingIndicator.hidden = !(state.busy && state.persona && !state.ended);
  }
  function setBusy(isBusy){
    state.busy = isBusy;
    refreshControls();
  }

  function showError(message, retryFn){
    errorText.textContent = message;
    errorBanner.hidden = false;
    lastFailedAction = retryFn || null;
    retryBtn.hidden = !retryFn;
  }
  function clearError(){
    errorBanner.hidden = true;
    lastFailedAction = null;
  }

  function renderMessages(){
    chatLog.innerHTML = '';
    if(state.messages.length === 0){
      chatLog.appendChild(emptyState);
      return;
    }
    var frag = document.createDocumentFragment();
    state.messages.forEach(function(m){
      var row = document.createElement('div');
      row.className = 'msg-row ' + (m.role === 'agent' ? 'from-agent' : 'from-customer');
      var bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.text;
      var metaEl = document.createElement('div');
      metaEl.className = 'msg-time';
      var parts = [(m.role === 'agent' ? 'You' : (state.persona ? state.persona.name : 'Customer')), fmtTime(m.ts)];
      if(m.gapSec != null) parts.push('+' + m.gapSec + 's wait');
      if(m.role === 'agent' && m.wpm) parts.push(m.wpm + ' WPM');
      metaEl.textContent = parts.join(' · ');
      row.appendChild(bubble);
      row.appendChild(metaEl);
      frag.appendChild(row);
    });
    chatLog.appendChild(frag);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderPersonaBar(){
    if(!state.persona){
      ticketIdEl.textContent = 'No active case';
      statusPill.hidden = true;
      chatMeta.textContent = '';
      return;
    }
    ticketIdEl.textContent = state.ticketId + ' · ' + state.persona.product;
    statusPill.hidden = false;
    statusPill.dataset.status = state.status.toLowerCase();
    statusPill.textContent = state.status === 'OPEN' ? 'Open' : (state.status === 'ESCALATED' ? 'Escalated' : 'Resolved');
    var color = guessEmotionColor(state.persona.emotionalState);
    chatMeta.innerHTML = '<span class="dot dot-' + color + '"></span>' +
      escapeHtml(state.persona.emotionalState) + ' · ' + escapeHtml(state.persona.issueCategory);
  }

  function renderTabs(){
    chatTabs.innerHTML = '';
    sessions.forEach(function(s, i){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-tab' + (i === activeIndex ? ' active' : '');
      var label = 'Chat ' + (i + 1);
      if(s.persona) label += ' · ' + (s.persona.name || '');
      b.textContent = label;
      b.title = s.persona ? (s.persona.name + ' — ' + s.persona.issueCategory) : 'No customer yet in this chat';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      b.addEventListener('click', (function(idx){ return function(){ activateChat(idx); }; })(i));
      chatTabs.appendChild(b);
    });
  }

  function updateCaseLabel(){
    if(!caseOpen) return;
    caseTabLabel.textContent = ' • Chat ' + (activeIndex + 1) + (state.persona ? (' — ' + state.persona.name) : ' (idle)');
  }

  function renderAnswerKey(){
    if(!trainerMode){
      answerKey.hidden = true;
      return;
    }
    answerKey.hidden = false;
    if(!state.persona){
      answerKeyContent.innerHTML = '<p class="muted" style="grid-column:1/-1;margin:0;">Start a scenario to reveal the answer key.</p>';
      return;
    }
    var p = state.persona;
    var keys = ['name','email','phone','product','macAddress','orderNumber'];
    var labels = ['Name','Email','Phone','Product','MAC address','Order / RMA #'];
    var rows = keys.map(function(k, i){ return [labels[i], p[k], (k==='macAddress'||k==='orderNumber')]; })
      .concat([['Purchase date', p.purchaseDate, false], ['Real issue & ideal resolution', p.hiddenSummary, false]]);
    answerKeyContent.innerHTML = rows.map(function(r){
      return '<dt>' + escapeHtml(r[0]) + '</dt><dd' + (r[2] ? ' class="mono"' : '') + '>' + escapeHtml(r[1] || '—') + '</dd>';
    }).join('');
  }

  function renderFeedback(){
    if(state.feedback){
      feedbackBox.hidden = false;
      feedbackContent.textContent = state.feedback;
    } else {
      feedbackBox.hidden = true;
    }
  }

  function clearCaseFields(){
    Object.keys(caseFields).forEach(function(k){ caseFields[k].value = ''; });
    Object.keys(state.notes).forEach(function(k){ state.notes[k] = ''; });
    state.traineeName = '';
    state.lob = '';
    fTraineeName.value = '';
    fLob.value = '';
  }

  /* ---------- per-session case fields swap ---------- */
  function captureNotes(){
    var n = state.notes;
    n.fCustomerName = caseFields.fCustomerName.value;
    n.fEmail = caseFields.fEmail.value;
    n.fProduct = caseFields.fProduct.value;
    n.fRecap = caseFields.fRecap.value;
    n.fResources = caseFields.fResources.value;
    n.fNextSteps = caseFields.fNextSteps.value;
    n.fEscalation = caseFields.fEscalation.value;
    state.traineeName = fTraineeName.value;
    state.lob = fLob.value;
  }
  function applyNotes(s){
    caseFields.fCustomerName.value = s.notes.fCustomerName;
    caseFields.fEmail.value = s.notes.fEmail;
    caseFields.fProduct.value = s.notes.fProduct;
    caseFields.fRecap.value = s.notes.fRecap;
    caseFields.fResources.value = s.notes.fResources;
    caseFields.fNextSteps.value = s.notes.fNextSteps;
    caseFields.fEscalation.value = s.notes.fEscalation;
    fTraineeName.value = s.traineeName;
    fLob.value = s.lob;
  }
  function activateChat(idx){
    if(idx === activeIndex) return;
    captureNotes();
    state = sessions[idx];
    activeIndex = idx;
    applyNotes(state);
    state.typeStart = null;
    renderTabs();
    renderPersonaBar();
    renderMessages();
    renderFeedback();
    renderAnswerKey();
    updateCaseLabel();
    refreshControls();
    updateSpeedUI();
    updateReplyTimer();
  }

  function ensureSlots(){
    var want = twoChats ? 2 : 1;
    if(sessions.length < want){
      sessions.push(newSession());
    } else if(sessions.length > want){
      if(activeIndex >= want) activeIndex = want - 1;
      sessions = sessions.slice(0, want);
      state = sessions[activeIndex];
    }
    if(activeIndex >= sessions.length) activeIndex = sessions.length - 1;
    state = sessions[activeIndex];
  }

  /* ---------- local persistence ---------- */
  function readLS(key){
    try { return JSON.parse(localStorage.getItem(key)); } catch(e){ return null; }
  }
  function writeLS(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
  }

  var saveTimer = null;
  function scheduleSave(){
    saveIndicator.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSession, 500);
  }
  async function saveSession(){
    if(!state.sessionId) return;
    var payload = {
      id: state.sessionId,
      ticketId: state.ticketId,
      createdAt: state.createdAt,
      persona: state.persona,
      messages: state.messages,
      status: state.status,
      feedback: state.feedback,
      notes: {
        customerName: caseFields.fCustomerName.value,
        email: caseFields.fEmail.value,
        product: caseFields.fProduct.value,
        recap: caseFields.fRecap.value,
        resources: caseFields.fResources.value,
        nextSteps: caseFields.fNextSteps.value,
        escalation: caseFields.fEscalation.value
      },
      traineeName: fTraineeName.value,
      lob: fLob.value,
      avgWpm: state.avgWpm,
      coachingPoints: state.coachingPoints
    };
    try {
      localStorage.setItem('session:' + state.sessionId, JSON.stringify(payload));
      updateIndex(payload);
      saveIndicator.textContent = 'Saved';
    } catch(e){
      saveIndicator.textContent = 'Not saved — storage is full';
    }
  }
  function updateIndex(payload){
    var index = readLS('session-index') || [];
    index = index.filter(function(i){ return i.id !== payload.id; });
    index.unshift({
      id: payload.id,
      ticketId: payload.ticketId,
      createdAt: payload.createdAt,
      name: payload.persona ? payload.persona.name : 'Unknown',
      category: payload.persona ? payload.persona.issueCategory : '',
      status: payload.status
    });
    index = index.slice(0, 50);
    writeLS('session-index', index);
  }
  function loadSettings(){
    var s = readLS('settings') || {};
    trainerMode = !!s.trainerMode;
    trainerModeToggle.checked = trainerMode;
    twoChats = !!s.twoChats;
    twoChatsToggle.checked = twoChats;
    timerOn = !!s.timerOn;
    timerToggle.checked = timerOn;
    replyTimer.hidden = !timerOn;
    fTraineeName.value = s.traineeName || '';
    fLob.value = s.lob || '';
    ensureSlots();
  }
  function saveSettings(){
    var s = readLS('settings') || {};
    s.trainerMode = trainerMode;
    s.twoChats = twoChats;
    s.timerOn = timerOn;
    writeLS('settings', s);
  }
  function recordTraineeSummary(){
    var s = readLS('settings') || {};
    s.traineeName = fTraineeName.value;
    s.lob = fLob.value;
    writeLS('settings', s);
  }

  function openHistory(){
    historyModal.hidden = false;
    var index = readLS('session-index') || [];
    if(index.length === 0){
      historyList.innerHTML = '<p class="muted">No past sessions yet.</p>';
      return;
    }
    historyList.innerHTML = '';
    index.forEach(function(item){
      var row = document.createElement('button');
      row.className = 'history-item';
      row.type = 'button';
      row.innerHTML = '<strong>' + escapeHtml(item.ticketId || '') + '</strong> · ' + escapeHtml(item.name) +
        '<br><span class="muted">' + escapeHtml(item.category || '') + ' · ' +
        new Date(item.createdAt).toLocaleString() + ' · ' + item.status + '</span>';
      row.addEventListener('click', function(){ viewSession(item.id); });
      historyList.appendChild(row);
    });
  }
  function viewSession(id){
    var data = readLS('session:' + id);
    if(!data) return;
    var html = '<button class="btn btn-ghost back-btn" id="backToList">← Back</button>';
    html += '<h3>' + escapeHtml(data.ticketId || '') + '</h3>';
    if(data.persona){
      html += '<p class="muted">' + escapeHtml(data.persona.issueCategory) + ' · ' + escapeHtml(data.persona.emotionalState) + '</p>';
    }
    html += '<div class="history-transcript">';
    (data.messages || []).forEach(function(m){
      var who = (m.role === 'agent' ? 'Agent' : (data.persona ? data.persona.name : 'Customer'));
      var meta = (m.gapSec != null ? ' · +' + m.gapSec + 's wait' : '') + (m.role === 'agent' && m.wpm ? ' · ' + m.wpm + ' WPM' : '');
      html += '<div class="msg-row ' + (m.role === 'agent' ? 'from-agent' : 'from-customer') +
        '"><div class="bubble">' + escapeHtml(m.text) + '</div>' +
        '<div class="msg-time">' + escapeHtml(who + ' · ' + fmtTime(m.ts) + meta) + '</div></div>';
    });
    html += '</div>';
    if(data.notes){
      var n = data.notes;
      var noteParts = [
        ['Name', n.customerName], ['Email', n.email], ['Product', n.product],
        ['Recap / TS', n.recap], ['Resources', n.resources],
        ['Next Steps', n.nextSteps], ['Escalation POC', n.escalation]
      ];
      var printed = noteParts.filter(function(p){ return p[1]; })
        .map(function(p){ return '<strong>' + escapeHtml(p[0]) + ':</strong> ' + escapeHtml(p[1]); })
        .join('<br>');
      if(printed) html += '<h4>Case documentation</h4><p>' + printed + '</p>';
    }
    if(data.feedback){
      html += '<h4>Coaching notes</h4><p>' + escapeHtml(data.feedback) + '</p>';
    }
    if(data.coachingPoints){
      html += '<h4>Post-drill coaching points</h4><p>' + escapeHtml(data.coachingPoints) + '</p>';
    }
    if(data.avgWpm){
      html += '<p class="muted">Average typing speed: ' + data.avgWpm + ' WPM</p>';
    }
    historyList.innerHTML = html;
    $('backToList').addEventListener('click', openHistory);
  }

  /* ---------- Toggle popups / tabs ---------- */
  function setTwoChats(on){
    twoChats = on;
    ensureSlots();
    renderTabs();
    renderPersonaBar();
    renderMessages();
    refreshControls();
    updateCaseLabel();
    saveSettings();
  }
  function setCaseOpen(open){
    caseOpen = open;
    casePane.hidden = !open;
    if(open) updateCaseLabel();
  }
  function openCase(){ setCaseOpen(true); }
  function closeCaseFn(){ setCaseOpen(false); }

  /* ---------- Reply timer ---------- */
  function updateReplyTimer(){
    if(!timerOn){
      replyTimer.hidden = true;
      return;
    }
    replyTimer.hidden = false;
    var pending = state.persona && !state.ended &&
      state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'customer';
    if(!pending){
      replyTimer.classList.remove('timer-warn','timer-danger');
      replyTimerClock.textContent = '—';
      return;
    }
    var lastTs = state.messages[state.messages.length - 1].ts;
    var sec = Math.max(0, Math.floor((Date.now() - lastTs) / 1000));
    var mm = Math.floor(sec / 60);
    var ss = sec % 60;
    replyTimerClock.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
    replyTimer.classList.remove('timer-warn','timer-danger');
    if(sec > TIMER_DANGER) replyTimer.classList.add('timer-danger');
    else if(sec > TIMER_WARN) replyTimer.classList.add('timer-warn');
  }

  /* ---------- Scenario start ---------- */
  async function startScenario(){
    clearError();
    setBusy(true);
    chatLog.innerHTML = '<div class="loading-state">Connecting a new customer…</div>';
    statusPill.hidden = true;
    feedbackBox.hidden = true;
    state.feedback = null;
    state.typeStart = null;
    speedBar.hidden = false;
    updateSpeedUI();
    state.ended = false;
    endBtn.textContent = 'End conversation';
    delete endBtn.dataset.ended;
    coachingBox.hidden = true;
    avgWpmBox.hidden = true;
    state.avgWpm = null;
    state.coachingPoints = null;

    var category = CATEGORY_LABELS[categorySelect.value];
    var emotion = EMOTION_LABELS[emotionSelect.value];

    var system = [
      "You generate one fictional customer persona and an opening live-chat message for a customer-support training simulator.",
      "The simulator is used by an outsourced (BPO) support team that handles live chat for Wyze, a smart-home device brand (cameras, video doorbells, sensors, locks, plugs, robot vacuums, etc.).",
      "",
      "Hard rules:",
      "- Every personal detail you invent (name, email, phone, MAC address, order number) must be fictional. Never use a real person's information.",
      "- Use a non-routable example email domain such as example.com, example.net, or mailmail.example.",
      "- Format the MAC address as six colon-separated hex pairs, e.g. AA:BB:CC:11:22:33, using invented hex values.",
      "- Invent a plausible order number in a realistic e-commerce ID format, clearly fictional.",
      "",
      "Scenario type to use: " + category,
      "Emotional tone to use: " + emotion,
      "",
      "Pick ONE specific, real-sounding Wyze product that fits the scenario, from this full product catalog. Spread across ALL of these families broadly over time — do not keep defaulting to the same family (e.g. don't always reach for indoor video cameras):",
      WYZE_CATALOG,
      "",
      "Products already used earlier in this practice session — AVOID reusing the exact same model/version of any of these, and prefer a different family where another product fits the scenario just as well:",
      usedProductsLabel(),
      "",
      "Diversity rules:",
      "- If the customer's issue could involve any one of several products, vary which one you pick so repeats don't happen.",
      "- Never return the exact same model + version (e.g. Wyze Cam v3, Wyze Thermostat) that the used list shows, unless literally no other product fits the scenario.",
      "- Invent a specific, concrete issue for that specific product rather than a vague one, and choose the version that plausibly matches the issue (e.g. a battery-drain concern on a battery cam, a Cam Plus feature on a subscription product).",
      "Write the opening message the way a real person types into a live chat: natural, not overly formal, length and tone matching the emotional state.",
      "",
      "hiddenSummary is for the trainer only: 2-4 sentences on the real root cause and the ideal resolution / verification steps an agent should follow.",
      "Respond ONLY with JSON matching the requested schema. Do not use markdown."
    ].join('\n');

    var schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        product: { type: "string" },
        macAddress: { type: "string" },
        orderNumber: { type: "string" },
        purchaseDate: { type: "string" },
        issueCategory: { type: "string" },
        emotionalState: { type: "string" },
        hiddenSummary: { type: "string" },
        openingMessage: { type: "string" }
      },
      required: ["name","email","phone","product","macAddress","orderNumber","purchaseDate","issueCategory","emotionalState","hiddenSummary","openingMessage"],
      additionalProperties: false
    };

    try {
      var raw = await runModel(
        [{ role: "system", content: system }, { role: "user", content: "Generate the persona and opening message now." }],
        { schema: schema }
      );
      var persona = JSON.parse(raw);
      state.persona = persona;
      recordUsedProduct(persona);
      state.sessionId = genId('sess');
      state.ticketId = genTicketId();
      state.createdAt = Date.now();
      state.status = 'OPEN';
      state.messages = [{ role: 'customer', text: persona.openingMessage, ts: Date.now(), gapSec: null }];
      clearCaseFields();
      renderPersonaBar();
      renderMessages();
      renderTabs();
      renderAnswerKey();
      renderFeedback();
      scheduleSave();
      updateCaseLabel();
    } catch(e){
      chatLog.innerHTML = '';
      chatLog.appendChild(emptyState);
      showError(e.message || 'Something went wrong starting the scenario.', startScenario);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Chat turn ---------- */
  function buildChatSystemPrompt(){
    var p = state.persona;
    return [
      "You are roleplaying as a customer named " + p.name + " in a live chat with a support agent for Wyze, a smart-home device brand.",
      "Stay fully in character. Never mention you are an AI, a model, or a simulation, and never write the agent's lines.",
      "",
      "Your full persona (for your own consistency only — reveal any of these specific facts ONLY if the agent directly asks for that piece of information, such as asking you to verify your account, name, email, or device MAC address; otherwise don't volunteer them):",
      "Name: " + p.name,
      "Email: " + p.email,
      "Phone: " + p.phone,
      "Product: " + p.product,
      "MAC address: " + p.macAddress,
      "Order number: " + p.orderNumber,
      "Purchase date: " + p.purchaseDate,
      "Underlying issue: " + p.issueCategory,
      "",
      "You already opened the chat with this message: \"" + p.openingMessage + "\"",
      "",
      "Starting emotional state: " + p.emotionalState + ".",
      "Let your tone shift naturally over the conversation: escalate and grow more frustrated if the agent is slow, dismissive, vague, or skips reasonable verification/troubleshooting steps; calm down and become more cooperative if the agent is clear, empathetic, and makes real progress on the issue.",
      "",
      "Style:",
      "- Write like a real person typing in a live chat: short to medium messages, casual punctuation, no long formal paragraphs, no markdown formatting.",
      "- Don't resolve your own issue or narrate outcomes for yourself — respond only as the customer would, reacting to what the agent just said.",
      "- Give your name, email, MAC address, order number, or purchase date only if the agent asks for that specific piece of information, naturally, matching your current mood.",
      "",
      "Respond ONLY with JSON: one field \"message\" with your reply, and one field \"status\" set to exactly one of OPEN, ESCALATED, or RESOLVED reflecting the issue's state after this exchange."
    ].join('\n');
  }

  function lastCustomerTs(){
    for(var i = state.messages.length - 1; i >= 0; i--){
      if(state.messages[i].role === 'customer') return state.messages[i].ts;
    }
    return null;
  }

  async function sendAgentMessage(text, wpm){
    clearError();
    var prevTs = lastCustomerTs();
    var agentTs = Date.now();
    var gapSec = prevTs != null ? Math.max(0, Math.round((agentTs - prevTs) / 1000)) : null;
    state.messages.push({ role: 'agent', text: text, ts: agentTs, wpm: wpm || null, gapSec: gapSec });
    renderMessages();
    updateSpeedUI();
    scheduleSave();
    setBusy(true);

    var history = state.messages.slice(1).map(function(m){
      return { role: m.role === 'agent' ? 'user' : 'assistant', content: m.text };
    });

    var schema = {
      type: "object",
      properties: {
        message: { type: "string" },
        status: { type: "string", enum: ["OPEN","ESCALATED","RESOLVED"] }
      },
      required: ["message","status"],
      additionalProperties: false
    };

    try {
      var raw = await runModel(
        [{ role: "system", content: buildChatSystemPrompt() }].concat(history),
        { schema: schema }
      );
      var parsed = JSON.parse(raw);
      if(parsed && parsed.status) state.status = parsed.status;
      var custTs = Date.now();
      var agentPrevTs = null;
      for(var i = state.messages.length - 1; i >= 0; i--){ if(state.messages[i].role === 'agent'){ agentPrevTs = state.messages[i].ts; break; } }
      var custGap = agentPrevTs != null ? Math.max(0, Math.round((custTs - agentPrevTs) / 1000)) : null;
      state.messages.push({ role: 'customer', text: (parsed && parsed.message) || '', ts: custTs, gapSec: custGap });
      renderMessages();
      renderPersonaBar();
      scheduleSave();
    } catch(e){
      state.messages.pop();
      renderMessages();
      showError(e.message || "The customer didn't respond — try sending again.", function(){ sendAgentMessage(text); });
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Coaching feedback ---------- */
  async function getFeedback(){
    clearError();
    setBusy(true);
    var p = state.persona;
    var transcript = state.messages.map(function(m){
      return (m.role === 'agent' ? 'Agent' : 'Customer') + ': ' + m.text;
    }).join('\n');
    var system = [
      "You are a QA coach for a BPO contact-center team that handles live chat support for Wyze.",
      "You will be shown a training transcript between a trainee agent and a simulated customer, plus the ground-truth persona info used to build the simulation.",
      "Give concise, constructive coaching feedback in plain text (no markdown headers, no asterisks): a short line on what the trainee did well, a short line on what to improve (verification steps, empathy, clarity, troubleshooting accuracy, SOP adherence), and a brief overall rating from: Needs work / Developing / Solid / Excellent.",
      "Keep the whole thing under 180 words."
    ].join('\n');
    var userMsg = [
      "Ground truth persona: " + JSON.stringify({ name:p.name, product:p.product, issueCategory:p.issueCategory, macAddress:p.macAddress, hiddenSummary:p.hiddenSummary }),
      "",
      "Transcript:",
      transcript,
      "",
      "Please give your coaching feedback now."
    ].join('\n');
    try {
      var raw = await runModel(
        [{ role: "system", content: system }, { role: "user", content: userMsg }]
      );
      state.feedback = raw;
      renderFeedback();
      scheduleSave();
    } catch(e){
      showError(e.message || 'Could not generate feedback.', getFeedback);
    } finally {
      setBusy(false);
    }
  }

  function avgWpmValue(){
    var wpms = (state.messages || []).filter(function(m){ return m.role === 'agent' && m.wpm; }).map(function(m){ return m.wpm; });
    if(wpms.length === 0) return null;
    return Math.round(wpms.reduce(function(a,b){ return a+b; }, 0) / wpms.length);
  }

  async function endConversation(){
    if(state.ended || state.busy || !state.persona) return;
    clearError();
    state.ended = true;
    setBusy(true);
    endBtn.textContent = 'Ended';
    endBtn.dataset.ended = 'true';

    var avg = avgWpmValue();
    state.avgWpm = avg;
    avgWpmBox.hidden = false;
    avgWpmVal.textContent = avg ? avg + ' WPM' : '— (no timed replies)';

    var p = state.persona;
    var transcript = state.messages.map(function(m){
      return (m.role === 'agent' ? 'Agent' : 'Customer') + ': ' + m.text;
    }).join('\n');
    var system = [
      "You are a QA coach for a BPO contact-center team that handles live chat support for Wyze.",
      "A trainee just finished a simulated support conversation. Produce a concise, constructive post-conversation review in plain text (no markdown headers, no asterisks).",
      "Structure the response with these short sections, each 1-3 sentences:",
      "Strengths:",
      "Areas to improve:",
      "SOP / verification gaps:",
      "Overall rating (one of Needs work / Developing / Solid / Excellent):",
      "Keep the whole thing under 220 words."
    ].join('\n');
    var userMsg = [
      "Trainee Name: " + (fTraineeName.value.trim() || 'Not provided'),
      "LOB: " + (fLob.value.trim() || 'Not provided'),
      "Average typing speed: " + (avg === null ? 'not measured' : avg + ' WPM'),
      "Final conversation status: " + state.status,
      "",
      "Ground truth persona: " + JSON.stringify({ name:p.name, product:p.product, issueCategory:p.issueCategory, macAddress:p.macAddress, hiddenSummary:p.hiddenSummary }),
      "",
      "Full transcript:",
      transcript,
      "",
      "Provide the post-conversation coaching review now."
    ].join('\n');
    try {
      var raw = await runModel(
        [{ role: "system", content: system }, { role: "user", content: userMsg }]
      );
      coachingContent.textContent = raw;
      state.coachingPoints = raw;
      coachingBox.hidden = false;
      scheduleSave();
    } catch(e){
      showError(e.message || 'Could not generate coaching points.', endConversation);
      state.ended = false;
      endBtn.textContent = 'End conversation';
      delete endBtn.dataset.ended;
    } finally {
      setBusy(false);
    }
  }

  newScenarioBtn.addEventListener('click', startScenario);
  chatForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    var text = agentInput.value.trim();
    if(!text || state.busy || !state.persona) return;
    var sentWpm = state.typeStart ? wpmFrom(agentInput.value.length, state.typeStart) : null;
    agentInput.value = '';
    state.typeStart = null;
    updateSpeedUI();
    sendAgentMessage(text, sentWpm);
  });
  agentInput.addEventListener('input', function(){
    if(!state.typeStart && agentInput.value) state.typeStart = Date.now();
    updateSpeedUI();
  });
  agentInput.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter' && !ev.shiftKey){
      ev.preventDefault();
      chatForm.requestSubmit();
    }
  });
  feedbackBtn.addEventListener('click', getFeedback);
  trainerModeToggle.addEventListener('change', function(){
    trainerMode = trainerModeToggle.checked;
    renderAnswerKey();
    saveSettings();
  });
  twoChatsToggle.addEventListener('change', function(){
    setTwoChats(twoChatsToggle.checked);
  });
  timerToggle.addEventListener('change', function(){
    timerOn = timerToggle.checked;
    replyTimer.hidden = !timerOn;
    updateReplyTimer();
    saveSettings();
  });
  caseBtn.addEventListener('click', openCase);
  closeCase.addEventListener('click', closeCaseFn);
  Object.keys(caseFields).forEach(function(k){ caseFields[k].addEventListener('input', scheduleSave); });
  endBtn.addEventListener('click', endConversation);
  [fTraineeName, fLob].forEach(function(el){
    el.addEventListener('input', recordTraineeSummary);
  });
  retryBtn.addEventListener('click', function(){
    var fn = lastFailedAction;
    clearError();
    if(fn) fn();
  });
  historyBtn.addEventListener('click', openHistory);
  $('closeHistory').addEventListener('click', function(){ historyModal.hidden = true; });
  infoBtn.addEventListener('click', function(){ infoModal.hidden = false; });
  $('closeInfo').addEventListener('click', function(){ infoModal.hidden = true; });
  [historyModal, infoModal].forEach(function(m){
    m.addEventListener('click', function(ev){ if(ev.target === m) m.hidden = true; });
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape'){ historyModal.hidden = true; infoModal.hidden = true; if(caseOpen) closeCaseFn(); }
  });
  copyBtn.addEventListener('click', async function(){
    var lines = [];
    if(state.ticketId) lines.push('Case: ' + state.ticketId);
    state.messages.forEach(function(m){
      lines.push((m.role === 'agent' ? 'Agent' : 'Customer') + ': ' + m.text);
    });
    lines.push('');
    lines.push('Name: ' + (caseFields.fCustomerName.value || '(none)'));
    lines.push('Email: ' + (caseFields.fEmail.value || '(none)'));
    lines.push('Product: ' + (caseFields.fProduct.value || '(none)'));
    lines.push('Recap / TS: ' + (caseFields.fRecap.value || '(none)'));
    lines.push('Resources: ' + (caseFields.fResources.value || '(none)'));
    lines.push('Next Steps: ' + (caseFields.fNextSteps.value || '(none)'));
    lines.push('Escalation POC: ' + (caseFields.fEscalation.value || '(none)'));
    var text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
    } catch(e){
      copyBtn.textContent = 'Could not copy';
    }
    setTimeout(function(){ copyBtn.textContent = 'Copy transcript & notes'; }, 1600);
  });

  setInterval(updateReplyTimer, 250);

  loadSettings();
  renderTabs();
  renderAnswerKey();
  renderMessages();
  refreshControls();
  updateReplyTimer();
})();