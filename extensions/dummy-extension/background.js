// Privacy Settings Helper - Background Service Worker
// This extension helps manage privacy preferences

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Privacy Settings Helper installed');
  }
});

//service worker
self.addEventListener('activate', (event) => {
  console.log('Privacy Settings Helper activated');
});
