<template>
  <div id="app" :class="{ light: isLight }">
    <nav>
      <router-link to="/">Home</router-link>
      <router-link to="/video">Video Editor</router-link>
      <router-link to="/image">Image Editor</router-link>
      <button class="theme-toggle" @click="toggleTheme">
        {{ isLight ? '\u{1F319}' : '\u{2600}\u{FE0F}' }}
      </button>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isLight: localStorage.getItem('theme') === 'light',
    }
  },
  watch: {
    isLight(v) {
      localStorage.setItem('theme', v ? 'light' : 'dark')
    },
  },
  methods: {
    toggleTheme() {
      this.isLight = !this.isLight
    },
  },
}
</script>

<style>
:root {
  --bg-page: #0f0f0f;
  --bg-surface: #1a1a1a;
  --bg-elevated: #141414;
  --bg-input: #1a1a1a;
  --bg-video: #000;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --text-muted: #555;
  --border: #333;
  --border-light: #444;
  --border-subtle: #2a2a2a;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --purple: #8b5cf6;
  --modal-overlay: rgba(0,0,0,.7);
}

.light {
  --bg-page: #f1f5f9;
  --bg-surface: #ffffff;
  --bg-elevated: #f8fafc;
  --bg-input: #ffffff;
  --bg-video: #000;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-light: #cbd5e1;
  --border-subtle: #f1f5f9;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --purple: #7c3aed;
  --modal-overlay: rgba(0,0,0,.25);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
#app { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-page); color: var(--text-primary); }
nav { background: var(--bg-surface); padding: 12px 24px; display: flex; gap: 24px; border-bottom: 1px solid var(--border); align-items: center; }
nav a { color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 500; transition: color .2s; }
nav a:hover, nav a.router-link-active { color: var(--text-primary); }
.theme-toggle { margin-left: auto; background: none; border: 1px solid var(--border); padding: 4px 10px; font-size: 16px; cursor: pointer; border-radius: 6px; line-height: 1; }
.theme-toggle:hover { border-color: var(--text-secondary); }
main { flex: 1; padding: 20px; width: 100%; }
@media (min-width: 1600px) { main { padding: 32px; } }
@media (min-width: 2200px) { main { padding: 40px; } }
button { cursor: pointer; background: var(--accent); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; transition: background .2s; }
button:hover { background: var(--accent-hover); }
button:disabled { opacity: .5; cursor: default; }
button.danger { background: var(--danger); }
button.danger:hover { background: var(--danger-hover); }
input, textarea, select { background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); padding: 8px 12px; border-radius: 6px; font-size: 14px; }
input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); }
</style>
