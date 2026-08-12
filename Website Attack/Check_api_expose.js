// Test common API routes
const endpoints = [
  '/api/users',
  '/api/faculty',
  '/api/lecturers',
  '/api/auth/session',
  '/api/auth/providers',
  '/api/departments',
  '/api/courses',
  '/.env',
  '/api/config'
];

endpoints.forEach(ep => {
  fetch(ep).then(r => {
    console.log(`${ep}: ${r.status} ${r.statusText}`);
    if (r.status !== 404) {
      r.text().then(t => console.log(`  BODY: ${t.substring(0, 200)}`));
    }
  }).catch(e => console.log(`${ep}: ERROR`));
});