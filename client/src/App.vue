<template>
  <div id="app">
    <nav>
      <router-link to="/">Home</router-link>
      <router-link to="/video">Video Editor</router-link>
      <router-link to="/image">Image Editor</router-link>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; }
#app { min-height: 100vh; display: flex; flex-direction: column; }
nav { background: #1a1a1a; padding: 12px 24px; display: flex; gap: 24px; border-bottom: 1px solid #333; }
nav a { color: #aaa; text-decoration: none; font-size: 14px; font-weight: 500; transition: color .2s; }
nav a:hover, nav a.router-link-active { color: #fff; }
main { flex: 1; padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; }
button { cursor: pointer; background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; transition: background .2s; }
button:hover { background: #2563eb; }
button:disabled { opacity: .5; cursor: default; }
button.danger { background: #ef4444; }
button.danger:hover { background: #dc2626; }
input, textarea, select { background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; padding: 8px 12px; border-radius: 6px; font-size: 14px; }
input:focus, textarea:focus, select:focus { outline: none; border-color: #3b82f6; }
</style>
