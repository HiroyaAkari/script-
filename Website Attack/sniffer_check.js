window._origFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  const urlStr = url.toString ? url.toString() : url;
  console.log(`%c[ENI] ${options?.method||'GET'} ${urlStr}`, 'color: #2f6fce; font-weight: bold;');
  
  return window._origFetch(...args).then(async r => {
    const clone = r.clone();
    const text = await clone.text();
    const lines = text.trim().split('\n');
    const jsonLine = lines.find(l => l.includes('"success"') || l.includes('"message"'));
    if (jsonLine) {
      try {
        const data = JSON.parse(jsonLine);
        console.log(`%c[ENI RESPONSE] ${r.status}`, 'color: #16a34a; font-weight: bold;', data);
      } catch(e) {
        console.log(`%c[ENI RAW] ${r.status}`, 'color: #a66b18;', text.substring(0, 300));
      }
    } else {
      console.log(`%c[ENI RAW] ${r.status} (no JSON found)`, 'color: #dc2626;', text.substring(0, 200));
    }
    return r;
  });
};
console.log('%c[ENI] Sniffer active. Now submit the form with peng.kun@rupp.edu.kh', 'color: #2f6fce; font-size: 14px; font-weight: bold;');