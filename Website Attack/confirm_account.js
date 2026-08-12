// ENI Verification Probe - Real Target Email
const targetEmail = "peng.kun@rupp.edu.kh";
const testPassword = "Password123"; // dummy, just to trigger the check

console.log('%c[ENI] Testing real faculty email...', 'color: #2f6fce; font-size: 14px; font-weight: bold;');

fetch('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: targetEmail,
    password: testPassword,
    hash: "00000000000000000000000000000000", // dummy hash
    device_type: "desktop",
    os_name: "Windows",
    browser_name: "Chrome"
  })
}).then(async r => {
  const text = await r.text();
  console.log('%c[ENI STATUS]', 'color: #9333ea; font-weight: bold;', r.status);
  console.log('%c[ENI RAW RESPONSE]', 'color: #a66b18;', text);
  
  // Parse out just the JSON part (skip the RSC flight data)
  const lines = text.trim().split('\n');
  const jsonLine = lines.find(l => l.includes('"success"'));
  if (jsonLine) {
    const data = JSON.parse(jsonLine);
    console.log('%c[ENI PARSED]', 'color: #16a34a; font-weight: bold;', data);
    
    if (data.message === "User was not found.") {
      console.log('%c[ENI] Same error — email might not be in THIS system.', 'color: #dc2626;');
    } else {
      console.log('%c[ENI] DIFFERENT RESPONSE — ACCOUNT EXISTS!', 'color: #16a34a; font-size: 16px; font-weight: bold;');
      console.log('%c[ENI] Message:', data.message);
    }
  }
});