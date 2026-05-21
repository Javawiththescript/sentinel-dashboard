# SENTINEL — Global Tension Intelligence Dashboard

A real-time global conflict and geopolitical tension dashboard with AI-powered news summarization, an interactive 3D globe, voice assistant briefings, and smart notifications.

## Features

- 🌍 **Interactive 3D Globe** — Rotating globe with color-coded event markers (drag to explore)
- 📰 **AI Intelligence Feed** — Live news fetched and summarized by Claude AI with web search
- 🔍 **Smart Filters** — Filter by region, category, and priority level
- 🎙️ **Voice Briefing Assistant** — Click the mic to ask questions or get a full spoken briefing
- 🔔 **Priority Notifications** — Browser notifications for critical events
- 📊 **Tension Index** — Real-time global tension scoring based on event severity
- 🗺️ **Region Breakdown** — Visual breakdown of events by geographic region

## Quick Start

### Option 1: Direct File Opening
1. Download or clone this repository
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge)
3. Click **LOAD DEMO DATA** to see the dashboard with sample events

### Option 2: GitHub Pages (Recommended)
1. Fork or upload this repository to GitHub
2. Go to **Settings → Pages**
3. Set Source to `main` branch, root folder
4. Your dashboard will be live at `https://yourusername.github.io/sentinel-dashboard`

### Option 3: Local Server
```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```
Then open `http://localhost:8080`

## Adding Your Anthropic API Key

To enable live AI-powered news and voice responses, add your API key:

1. Open `js/app.js`
2. The fetch calls to `https://api.anthropic.com/v1/messages` will automatically use your key if you add a Cloudflare Worker or backend proxy
3. **For production**: Never expose API keys in client-side code. Use a backend proxy or Cloudflare Worker

### Simple Cloudflare Worker Proxy
```javascript
export default {
  async fetch(request) {
    const body = await request.json();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY_HERE',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interop-2025-03-01'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
```
Then update `ANTHROPIC_API` in `app.js` to point to your worker URL.

## Voice Assistant Commands

- **"Give me a briefing"** — Full spoken intelligence briefing
- **"What's happening in [region]?"** — Regional status update
- **"How many critical events?"** — Quick stats
- **"Stop"** — Stop current speech
- **Click mic button** — Ask any question about current events

## File Structure
```
sentinel-dashboard/
├── index.html          # Main HTML
├── css/
│   └── style.css       # Dark intelligence aesthetic
├── js/
│   ├── app.js          # Core logic, AI integration, voice
│   └── globe.js        # Three.js 3D globe renderer
└── README.md
```

## Browser Requirements
- Chrome 88+ (best experience, full Web Speech API support)
- Firefox 78+
- Edge 88+
- **Notifications**: Click the bell icon and allow browser notifications
- **Voice**: Click the mic icon and allow microphone access

## Customization

### Adding Custom Events
Edit the `allEvents` array in `js/app.js` or the `loadDemoData()` function.

### Changing Refresh Interval
Find `setInterval(() => fetchNews()...`, 600000)` in `app.js` and change `600000` (10 min in ms).

### Color Scheme
All CSS variables are in `:root` in `css/style.css`. Key colors:
- `--accent`: Cyan highlight color
- `--critical`: Red for critical events
- `--high`: Orange for high priority
- `--bg-0` through `--bg-4`: Background layers

## Technologies
- **Three.js r128** — 3D globe rendering
- **Web Speech API** — Voice recognition and TTS
- **Claude API** — AI summarization and voice Q&A
- **Vanilla JS** — No framework dependencies
- **CSS Custom Properties** — Theming system

---
Built for situational awareness. Not a substitute for professional intelligence analysis.
