try {
  var theme = localStorage.getItem('push-theme');
  document.documentElement.dataset.theme = theme === 'dark' || ((!theme || theme === 'system') && matchMedia('(prefers-color-scheme:dark)').matches) ? 'dark' : 'light';
} catch (_) { /* The default light theme remains usable. */ }
