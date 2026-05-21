/* ─── APP.JS — SENTINEL Dashboard Main Logic ─────────────────────── */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ─── STATE ─────────────────────────────────────────────────────────
let allEvents = [];
let filteredEvents = [];
let notifPermission = 'default';
let currentlySpeaking = false;
let speechSynthesis = window.speechSynthesis;
let recognition = null;
let notifiedIds = new Set();

// ─── REGION GEO COORDS (for globe focusing) ──────────────────────
const REGION_COORDS = {
  'Middle East': { lat: 29, lon: 45 },
  'Europe':      { lat: 52, lon: 15 },
  'East Asia':   { lat: 35, lon: 115 },
  'South Asia':  { lat: 23, lon: 80 },
  'Africa':      { lat: 0,  lon: 20 },
  'Americas':    { lat: 15, lon: -90 },
  'Central Asia':{ lat: 43, lon: 65 },
};

// ─── CLOCK ─────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const utc = now.toUTCString().replace('GMT', 'UTC').split(' ').slice(4).join(' ');
  const hms = now.toUTCString().match(/(\d{2}:\d{2}:\d{2})/)?.[1] || '';
  document.getElementById('live-clock').textContent = hms + ' UTC';
}
setInterval(updateClock, 1000);
updateClock();

// ─── FETCH NEWS via Claude API ─────────────────────────────────────
async function fetchNews() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('loading');
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('event-feed').innerHTML = '<div class="loading-state" id="loading-state"><div class="loading-spinner"></div><div>ACQUIRING INTELLIGENCE...</div></div>';

  const today = new Date().toDateString();
  const prompt = `You are an intelligence analyst. Today is ${today}. Search the web for the latest real breaking news and global tension events from the past 24-48 hours. Return a JSON array of 12-16 real, current events related to military conflict, geopolitical tensions, diplomatic crises, cyber attacks, economic warfare, or humanitarian emergencies. Focus on what is actually happening RIGHT NOW in the world.

Each event must be a real, current news story. Return ONLY a JSON array with no other text:
[
  {
    "id": "unique_id_1",
    "title": "Concise headline (max 15 words)",
    "summary": "2-3 sentence summary of the actual current event",
    "region": "one of: Middle East, Europe, East Asia, South Asia, Africa, Americas, Central Asia",
    "category": "one of: Military, Diplomatic, Economic, Cyber, Political, Humanitarian",
    "priority": "one of: critical, high, medium, low",
    "lat": latitude_number,
    "lon": longitude_number,
    "country": "primary country involved",
    "timestamp": "hours ago e.g. 2h ago",
    "details": "3-4 sentence detailed analysis of this specific event, its context and potential implications",
    "sources": ["source1", "source2"]
  }
]

Assign priority based on: critical = active armed conflict/imminent threat, high = significant escalation/major incident, medium = developing situation/diplomatic crisis, low = tensions/warnings/statements.
Make sure lat/lon correspond to the event location. Return ONLY the JSON array.`;

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    // Extract text from response (may include tool use blocks)
    let rawText = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') rawText += block.text;
      }
    }

    // Parse JSON
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    const events = JSON.parse(jsonMatch[0]);

    allEvents = events.map((e, i) => ({ ...e, id: e.id || `ev_${i}`, isNew: true }));
    filteredEvents = [...allEvents];

    renderFeed();
    updateStats();
    updateGlobeMarkers(allEvents);
    updateRegionBars();
    updateTensionIndex();
    checkHighPriorityAlerts();

    // Clear "new" flag after a bit
    setTimeout(() => {
      allEvents.forEach(e => e.isNew = false);
    }, 30000);

  } catch (err) {
    console.error('Fetch error:', err);
    document.getElementById('event-feed').innerHTML = `
      <div class="loading-state">
        <div style="color:var(--critical); font-family:var(--font-mono); font-size:12px;">INTELLIGENCE FEED UNAVAILABLE</div>
        <div style="font-size:11px; color:var(--text-muted); text-align:center; max-width:220px; line-height:1.6;">Add your Anthropic API key to enable live intelligence feeds. Using demo data.</div>
        <button onclick="loadDemoData()" style="background:var(--accent-dim);border:1px solid var(--accent);color:var(--accent);padding:8px 16px;border-radius:5px;cursor:pointer;font-family:var(--font-condensed);font-size:11px;letter-spacing:2px;">LOAD DEMO DATA</button>
      </div>`;
  }
  btn.classList.remove('loading');
}

// ─── DEMO DATA ─────────────────────────────────────────────────────
function loadDemoData() {
  allEvents = [
    { id: 'e1', title: 'Artillery Exchanges Escalate Along Eastern Front', summary: 'Heavy artillery exchanges reported across a 40km stretch of the eastern front. Both sides claiming territorial advances. Civilian evacuations underway in three border towns.', region: 'Europe', category: 'Military', priority: 'critical', lat: 48.5, lon: 37.5, country: 'Ukraine', timestamp: '1h ago', details: 'The situation along the eastern front has deteriorated significantly in the past 24 hours. Artillery strikes have intensified with reports of cluster munitions being deployed near civilian areas. International monitors have been denied access to assess casualties. NATO has convened an emergency session to discuss response options.', sources: ['Reuters', 'BBC'], isNew: true },
    { id: 'e2', title: 'Taiwan Strait: PLA Conducts Live-Fire Naval Drills', summary: 'Chinese PLA Navy has announced and commenced large-scale live-fire exercises in the Taiwan Strait, deploying 40 vessels including carriers.', region: 'East Asia', category: 'Military', priority: 'critical', lat: 24.5, lon: 120.5, country: 'China/Taiwan', timestamp: '3h ago', details: 'The exercises follow recent US arms sales to Taiwan and represent the largest PLA naval deployment in the strait since 2022. Taiwan has raised its defense readiness to Level 2. Japan has scrambled fighter jets in response. The US 7th Fleet is monitoring from the South China Sea.', sources: ['AP', 'Reuters'], isNew: true },
    { id: 'e3', title: 'Iran Nuclear Facility Activity Detected by Satellite', summary: 'Intelligence agencies report unusual activity at Fordow nuclear facility. Enrichment levels reportedly approaching weapons-grade threshold.', region: 'Middle East', category: 'Military', priority: 'high', lat: 34.9, lon: 50.5, country: 'Iran', timestamp: '5h ago', details: 'Commercial satellite imagery analyzed by multiple think tanks shows increased vehicle activity and what appears to be new equipment being installed at the Fordow underground facility. IAEA inspectors have been denied access for the third consecutive week. European powers are consulting on next steps.', sources: ['NYT', 'Axios'], isNew: true },
    { id: 'e4', title: 'Major State-Sponsored Cyberattack Hits European Grid', summary: 'A coordinated cyberattack targeting power infrastructure across three EU nations knocked out electricity for 800,000 residents.', region: 'Europe', category: 'Cyber', priority: 'high', lat: 52.2, lon: 21, country: 'Poland', timestamp: '6h ago', details: 'Attribution points to a known advanced persistent threat (APT) group linked to state actors. The attack used a novel malware variant targeting SCADA systems. EU cybersecurity agency ENISA has activated its emergency response protocol. Power has been restored to most areas but some industrial regions remain offline.', sources: ['DW', 'Politico'], isNew: true },
    { id: 'e5', title: 'South China Sea: Philippines Vessel Confronted', summary: 'Philippine coast guard vessel confronted by Chinese maritime militia in disputed waters near Scarborough Shoal.', region: 'East Asia', category: 'Diplomatic', priority: 'high', lat: 15.1, lon: 117.7, country: 'Philippines', timestamp: '8h ago', details: 'The incident involved water cannons being deployed against a Philippine resupply mission. Three Filipino sailors were reported injured. The US has invoked the Mutual Defense Treaty and deployed additional naval assets to the region. ASEAN has called for restraint from both sides.', sources: ['Reuters', 'CNN'], isNew: false },
    { id: 'e6', title: 'Sudan Humanitarian Crisis: Famine Conditions Declared', summary: 'UN officially declares famine conditions in North Darfur affecting 750,000 people as RSF and SAF fighting continues.', region: 'Africa', category: 'Humanitarian', priority: 'high', lat: 14.5, lon: 24.5, country: 'Sudan', timestamp: '9h ago', details: 'The UN World Food Programme says this is the worst food security crisis anywhere in the world. Aid convoys have been blocked for weeks by active fighting. Over 8 million people have been internally displaced since conflict began. The International Criminal Court is investigating reported atrocities.', sources: ['UN OCHA', 'WFP'], isNew: false },
    { id: 'e7', title: 'Venezuela-Guyana Border: Military Buildup Continues', summary: 'Venezuelan military continues buildup along the Essequibo border. US Southern Command has increased surveillance flights.', region: 'Americas', category: 'Military', priority: 'medium', lat: 6.5, lon: -62, country: 'Venezuela', timestamp: '12h ago', details: 'Despite an agreement at the Barbados summit, Venezuelan forces have continued massing along the disputed Essequibo border. Guyana has formally requested military assistance from CARICOM partners. The disputed oil-rich region holds significant hydrocarbon reserves recently certified by ExxonMobil.', sources: ['Reuters', 'Al Jazeera'], isNew: false },
    { id: 'e8', title: 'North Korea Fires Two Ballistic Missiles', summary: 'North Korea launched two short-range ballistic missiles into the East Sea, condemned by Japan, South Korea and the US.', region: 'East Asia', category: 'Military', priority: 'high', lat: 40, lon: 127.5, country: 'North Korea', timestamp: '14h ago', details: 'The launch came hours after joint US-South Korean military exercises concluded. Japan\'s coast guard issued warnings to shipping in the area. South Korea\'s National Security Council convened an emergency meeting. The missiles landed in the exclusive economic zone of Japan.', sources: ['Yonhap', 'NHK'], isNew: false },
    { id: 'e9', title: 'Pakistan-India: LoC Ceasefire Violations Surge', summary: 'Reports of increased ceasefire violations along the Line of Control in Kashmir. Both armies on heightened alert.', region: 'South Asia', category: 'Military', priority: 'medium', lat: 34, lon: 74.5, country: 'Pakistan/India', timestamp: '16h ago', details: 'The violations represent the most significant spike since the 2021 ceasefire agreement. Indian Army sources report sniper fire and small arms violations at six separate points along the LoC. Pakistan denies initiating fire. UN observers have been unable to access the area.', sources: ['The Hindu', 'Dawn'], isNew: false },
    { id: 'e10', title: 'Russia Seizes Foreign Assets: G7 Response Deliberated', summary: 'Russia formally legislates seizure of $300B in frozen foreign assets as Western nations deliberate response options.', region: 'Europe', category: 'Economic', priority: 'medium', lat: 55.7, lon: 37.6, country: 'Russia', timestamp: '18h ago', details: 'The Kremlin signed legislation nationalizing approximately $300 billion in frozen assets held by international investors. The G7 finance ministers held emergency calls to assess legal countermeasures. European equities fell sharply on the news. The move is seen as retaliation for Western asset freezes.', sources: ['FT', 'Bloomberg'], isNew: false },
    { id: 'e11', title: 'Sahel: Mali Junta Expels UN Peacekeeping Mission', summary: 'Mali\'s military government formally ordered MINUSMA to withdraw all remaining personnel within 72 hours.', region: 'Africa', category: 'Political', priority: 'medium', lat: 12.6, lon: -8, country: 'Mali', timestamp: '20h ago', details: 'The expulsion leaves a significant security vacuum in a region already struggling with Islamist insurgencies. France, which had already withdrawn its forces, expressed concern. Russian Wagner Group presence in Mali has expanded significantly. The UN Security Council is meeting to discuss the implications.', sources: ['RFI', 'AFP'], isNew: false },
    { id: 'e12', title: 'Saudi-Houthi Peace Talks Break Down in Oman', summary: 'Mediated peace negotiations between Saudi Arabia and Houthi representatives collapsed after three days of talks in Muscat.', region: 'Middle East', category: 'Diplomatic', priority: 'medium', lat: 15.5, lon: 44.5, country: 'Yemen', timestamp: '22h ago', details: 'The talks reportedly broke down over disagreements on port revenues and prisoner exchanges. Houthi representatives walked out of the third session. Saudi Arabia has maintained a unilateral ceasefire but Houthi drone attacks on Saudi border towns have continued. UN envoy called the collapse "deeply regrettable".', sources: ['Reuters', 'Al Jazeera'], isNew: false },
  ];
  filteredEvents = [...allEvents];
  renderFeed();
  updateStats();
  if (typeof updateGlobeMarkers === 'function') updateGlobeMarkers(allEvents);
  updateRegionBars();
  updateTensionIndex();
  checkHighPriorityAlerts();
}

// ─── RENDER FEED ───────────────────────────────────────────────────
function renderFeed() {
  const feed = document.getElementById('event-feed');
  feed.innerHTML = '';

  if (filteredEvents.length === 0) {
    feed.innerHTML = '<div class="loading-state"><div>NO EVENTS MATCH FILTERS</div></div>';
    document.getElementById('feed-count').textContent = '0 events';
    return;
  }

  document.getElementById('feed-count').textContent = `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`;

  filteredEvents.forEach(ev => {
    const card = document.createElement('div');
    card.className = `event-card priority-${ev.priority}`;
    card.innerHTML = `
      ${ev.isNew ? '<span class="new-badge">NEW</span>' : ''}
      <div class="event-card-header">
        <span class="event-priority">${ev.priority.toUpperCase()}</span>
        <span class="event-title">${ev.title}</span>
      </div>
      <div class="event-meta">
        <span class="event-region">${ev.country || ev.region}</span>
        <span class="event-category">${ev.category}</span>
        <span class="event-time">${ev.timestamp}</span>
      </div>
      <div class="event-summary">${ev.summary}</div>
    `;
    card.addEventListener('click', () => openEventModal(ev));
    feed.appendChild(card);
  });
}

// ─── FILTERS ───────────────────────────────────────────────────────
function applyFilters() {
  const region = document.getElementById('filter-region').value;
  const category = document.getElementById('filter-category').value;
  const priority = document.getElementById('filter-priority').value;

  filteredEvents = allEvents.filter(ev => {
    if (region !== 'all' && ev.region !== region) return false;
    if (category !== 'all' && ev.category !== category) return false;
    if (priority !== 'all' && ev.priority !== priority) return false;
    return true;
  });

  renderFeed();

  // Focus globe on region if selected
  if (region !== 'all' && REGION_COORDS[region] && typeof focusGlobeOnRegion === 'function') {
    focusGlobeOnRegion(REGION_COORDS[region].lat, REGION_COORDS[region].lon);
  }
}
window.applyFilters = applyFilters;

// ─── STATS ─────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-total').textContent = allEvents.length;
  document.getElementById('stat-critical').textContent = allEvents.filter(e => e.priority === 'critical').length;
  const regions = new Set(allEvents.map(e => e.region));
  document.getElementById('stat-regions').textContent = regions.size;
  document.getElementById('stat-24h').textContent = allEvents.filter(e => e.isNew || true).length;
  document.getElementById('alert-count').textContent = allEvents.filter(e => e.priority === 'critical' || e.priority === 'high').length + ' ALERTS';
}

// ─── TENSION INDEX ─────────────────────────────────────────────────
function updateTensionIndex() {
  const weights = { critical: 10, high: 5, medium: 2, low: 1 };
  const maxScore = allEvents.length * 10;
  const score = allEvents.reduce((sum, e) => sum + (weights[e.priority] || 0), 0);
  const pct = Math.min(100, Math.round((score / maxScore) * 100));
  document.getElementById('tension-fill').style.width = pct + '%';
  document.getElementById('tension-value').textContent = pct + '/100';
}

// ─── REGION BARS ───────────────────────────────────────────────────
function updateRegionBars() {
  const counts = {};
  allEvents.forEach(e => { counts[e.region] = (counts[e.region] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  const container = document.getElementById('region-bars');
  container.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([region, count]) => `
      <div class="region-bar-item">
        <div class="region-bar-label">${region}</div>
        <div class="region-bar-track"><div class="region-bar-fill" style="width:${Math.round((count/max)*100)}%"></div></div>
        <div class="region-bar-count">${count}</div>
      </div>
    `).join('');
}

// ─── ALERTS / NOTIFICATIONS ─────────────────────────────────────────
function checkHighPriorityAlerts() {
  const criticals = allEvents.filter(e => (e.priority === 'critical') && !notifiedIds.has(e.id));
  if (criticals.length > 0) {
    const ev = criticals[0];
    notifiedIds.add(ev.id);
    showNotificationBar(`⚠ CRITICAL: ${ev.title}`);
    if (notifPermission === 'granted') {
      new Notification('SENTINEL — Critical Alert', {
        body: ev.title,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⬡</text></svg>'
      });
    }
  }
}

function showNotificationBar(msg) {
  const bar = document.getElementById('notification-bar');
  document.getElementById('notif-text').textContent = msg;
  bar.classList.remove('hidden');
  setTimeout(() => bar.classList.add('hidden'), 12000);
}
window.dismissNotif = () => document.getElementById('notification-bar').classList.add('hidden');

function requestNotifPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(perm => {
      notifPermission = perm;
      const btn = document.getElementById('notif-toggle');
      if (perm === 'granted') {
        btn.style.color = 'var(--low)';
        btn.style.borderColor = 'var(--low)';
      }
    });
  }
}
window.requestNotifPermission = requestNotifPermission;

// ─── MODAL ─────────────────────────────────────────────────────────
function openEventModal(ev) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const priorityColors = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };

  content.innerHTML = `
    <div class="modal-priority" style="color:${priorityColors[ev.priority]}">${ev.priority.toUpperCase()} PRIORITY</div>
    <h2>${ev.title}</h2>
    <div class="modal-meta-row">
      <span class="modal-tag">📍 ${ev.country || ev.region}</span>
      <span class="modal-tag">${ev.region}</span>
      <span class="modal-tag">${ev.category}</span>
      <span class="modal-tag">${ev.timestamp}</span>
    </div>
    <div class="modal-section-label">SITUATION SUMMARY</div>
    <div class="modal-body">${ev.summary}</div>
    <div class="modal-section-label">INTELLIGENCE ANALYSIS</div>
    <div class="modal-analysis" id="modal-analysis-text">Generating analysis...</div>
    ${ev.sources ? `<div class="modal-section-label">SOURCES</div><div class="modal-body" style="font-size:11px; color:var(--text-muted);">${ev.sources.join(' · ')}</div>` : ''}
  `;

  overlay.classList.add('open');

  // Set analysis
  if (ev.details) {
    document.getElementById('modal-analysis-text').textContent = ev.details;
    updateRightPanelAnalysis(ev);
  } else {
    generateAnalysis(ev);
  }
}
window.openEventModal = openEventModal;

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
window.closeModal = closeModal;

async function generateAnalysis(ev) {
  const el = document.getElementById('modal-analysis-text');
  if (!el) return;
  el.textContent = 'Analyzing...';
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: `In 3-4 sentences, provide a concise intelligence analysis of this event: "${ev.title}" in ${ev.country || ev.region}. Cover: immediate implications, regional stability impact, and key actors to watch.` }]
      })
    });
    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('') || 'Analysis unavailable.';
    el.textContent = text;
    ev.details = text;
    updateRightPanelAnalysis(ev);
  } catch { el.textContent = ev.details || 'Analysis unavailable without API key.'; }
}

function updateRightPanelAnalysis(ev) {
  const el = document.getElementById('analysis-content');
  el.innerHTML = `
    <div style="font-family:var(--font-condensed);font-size:10px;letter-spacing:2px;color:var(--text-muted);margin-bottom:8px;">${ev.country || ev.region} — ${ev.category}</div>
    <div style="font-family:var(--font-condensed);font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px;line-height:1.3;">${ev.title}</div>
    <div class="analysis-typing">${ev.details || 'Loading...'}</div>
  `;
  // Remove typing cursor when done
  setTimeout(() => {
    const t = el.querySelector('.analysis-typing');
    if (t) t.classList.remove('analysis-typing');
  }, 100);
}

// ─── VOICE ASSISTANT ───────────────────────────────────────────────
function toggleVoiceAssistant() {
  const panel = document.getElementById('voice-panel');
  const btn = document.getElementById('voice-btn');
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    btn.classList.remove('active');
    stopSpeaking();
  } else {
    panel.classList.add('open');
    btn.classList.add('active');
  }
}
window.toggleVoiceAssistant = toggleVoiceAssistant;

function closeVoicePanel() {
  document.getElementById('voice-panel').classList.remove('open');
  document.getElementById('voice-btn').classList.remove('active');
  stopSpeaking();
}
window.closeVoicePanel = closeVoicePanel;

function stopSpeaking() {
  if (speechSynthesis) speechSynthesis.cancel();
  currentlySpeaking = false;
  document.getElementById('waveform-bars').classList.remove('active');
  document.getElementById('voice-status').textContent = 'Stopped.';
  if (recognition) try { recognition.stop(); } catch(e) {}
}
window.stopSpeaking = stopSpeaking;

async function requestFullBriefing() {
  const status = document.getElementById('voice-status');
  const transcript = document.getElementById('voice-transcript');
  const waveform = document.getElementById('waveform-bars');

  if (allEvents.length === 0) {
    speak('No intelligence data loaded. Please refresh the intelligence feed first.');
    return;
  }

  status.textContent = 'Generating briefing...';
  transcript.textContent = '';

  const eventSummary = allEvents.slice(0, 8).map((e, i) =>
    `${i+1}. [${e.priority.toUpperCase()}] ${e.title} — ${e.region}: ${e.summary}`
  ).join('\n');

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: `You are a voice intelligence briefing officer. Give a concise, professional verbal briefing (under 400 words) on the following global events. Start with: "Good [morning/afternoon/evening], here is your intelligence briefing." Cover the most critical items first, then medium priority. End with a one-sentence overall threat assessment. Keep it conversational and clear for audio delivery.\n\nEvents:\n${eventSummary}` }]
      })
    });
    const data = await res.json();
    const briefing = data.content?.map(b => b.text || '').join('') || generateLocalBriefing();
    transcript.textContent = briefing;
    speak(briefing, waveform, status);
  } catch {
    const briefing = generateLocalBriefing();
    transcript.textContent = briefing;
    speak(briefing, waveform, status);
  }
}
window.requestFullBriefing = requestFullBriefing;

function generateLocalBriefing() {
  const criticals = allEvents.filter(e => e.priority === 'critical');
  const highs = allEvents.filter(e => e.priority === 'high');
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  let briefing = `Good ${timeOfDay}. Here is your intelligence briefing. `;
  briefing += `We are currently tracking ${allEvents.length} active events across ${new Set(allEvents.map(e=>e.region)).size} regions. `;
  if (criticals.length > 0) briefing += `${criticals.length} event${criticals.length > 1 ? 's are' : ' is'} at critical status. `;
  criticals.slice(0, 2).forEach(e => { briefing += `Critical: ${e.title}. ${e.summary} `; });
  highs.slice(0, 2).forEach(e => { briefing += `High priority: ${e.title}. `; });
  briefing += `Overall global tension index is elevated. Continue monitoring.`;
  return briefing;
}

function speak(text, waveformEl, statusEl) {
  if (!speechSynthesis) { if(statusEl) statusEl.textContent = 'TTS not supported'; return; }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 0.9;
  utter.volume = 1;

  // Pick a good voice
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.name.includes('US')) ||
                    voices.find(v => v.lang === 'en-US' && !v.localService) ||
                    voices.find(v => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;

  utter.onstart = () => {
    currentlySpeaking = true;
    if (waveformEl) waveformEl.classList.add('active');
    if (statusEl) statusEl.textContent = 'BROADCASTING BRIEFING...';
  };
  utter.onend = () => {
    currentlySpeaking = false;
    if (waveformEl) waveformEl.classList.remove('active');
    if (statusEl) statusEl.textContent = 'Briefing complete.';
  };
  utter.onerror = () => {
    if (statusEl) statusEl.textContent = 'Speech error. Check browser settings.';
  };
  speechSynthesis.speak(utter);
}

function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('voice-status').textContent = 'Speech recognition not supported in this browser.';
    return;
  }
  const micBtn = document.getElementById('mic-btn');
  const status = document.getElementById('voice-status');
  const transcript = document.getElementById('voice-transcript');

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.classList.add('listening');
    status.textContent = 'LISTENING...';
  };
  recognition.onresult = (e) => {
    const query = e.results[0][0].transcript;
    transcript.textContent = `You: "${query}"`;
    status.textContent = 'Processing...';
    micBtn.classList.remove('listening');
    handleVoiceQuery(query);
  };
  recognition.onerror = () => {
    micBtn.classList.remove('listening');
    status.textContent = 'Could not hear you. Try again.';
  };
  recognition.onend = () => micBtn.classList.remove('listening');
  recognition.start();
}
window.startListening = startListening;

async function handleVoiceQuery(query) {
  const transcript = document.getElementById('voice-transcript');
  const waveform = document.getElementById('waveform-bars');
  const status = document.getElementById('voice-status');

  const lowerQuery = query.toLowerCase();

  // Quick local commands
  if (lowerQuery.includes('briefing') || lowerQuery.includes('brief me') || lowerQuery.includes('what\'s happening')) {
    requestFullBriefing(); return;
  }
  if (lowerQuery.includes('stop') || lowerQuery.includes('quiet') || lowerQuery.includes('silence')) {
    stopSpeaking(); return;
  }

  // AI response
  const context = allEvents.slice(0, 10).map(e => `${e.title} (${e.region}, ${e.priority}): ${e.summary}`).join('\n');
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: `You are a concise intelligence briefing officer. Answer this question in 2-3 sentences based on current events data:\nQuestion: "${query}"\n\nCurrent events:\n${context}` }]
      })
    });
    const data = await res.json();
    const reply = data.content?.map(b => b.text || '').join('') || 'I could not retrieve that information right now.';
    transcript.textContent = `You: "${query}"\n\nSentinel: ${reply}`;
    speak(reply, waveform, status);
  } catch {
    const reply = `I'm unable to process that query without an active connection. Try requesting a full briefing.`;
    transcript.textContent = `You: "${query}"\n\nSentinel: ${reply}`;
    speak(reply, waveform, status);
  }
}

// Load voices async
if (speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {};
}

// ─── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Try live fetch, fallback to demo
  fetchNews().catch(() => loadDemoData());

  // Auto-refresh every 10 minutes
  setInterval(() => fetchNews().catch(() => {}), 600000);
});

window.fetchNews = fetchNews;
window.loadDemoData = loadDemoData;
