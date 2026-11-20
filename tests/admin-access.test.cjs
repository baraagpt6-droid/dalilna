'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const accountDialog = html.match(/<dialog id="accountDlg">([\s\S]*?)<\/dialog>/)?.[1];

function captureHandler(selector, eventName) {
  const escaped = selector.replace(/[.#]/g, '\\$&');
  const pattern = new RegExp('\\$\\("' + escaped + '"\\)\\.addEventListener\\("' + eventName + '",(?:async )?(?:\\([^)]*\\)|[\\w]*)=>\\{([\\s\\S]*?)\\n\\}\\);');
  return html.match(pattern)?.[1];
}

function makeElements() {
  const elements = new Map();
  const $ = selector => {
    if (!elements.has(selector)) {
      elements.set(selector, { value: '', textContent: '', hidden: false, type: 'password' });
    }
    return elements.get(selector);
  };
  return { $, elements };
}

test('admin login option is visible in the account menu', () => {
  assert.ok(accountDialog, 'account dialog exists');
  const button = accountDialog.match(/<button\b[^>]*id="roleAdminBtn"[^>]*>/)?.[0];
  assert.ok(button, 'admin login button exists inside account dialog');
  assert.doesNotMatch(button, /\shidden(?:\s|>|=)/, 'admin login button is not hidden');
  assert.match(accountDialog, /دخول المشرف/);
});

test('logo long-press login mechanism and stale click state are removed', () => {
  assert.doesNotMatch(html, /adminLongPressTimer|adminLongPressFired|startAdminLongPress|cancelAdminLongPress/);
  assert.doesNotMatch(html, /#roleAdminBtn"\)\.hidden=true/);
  const logoClick = html.match(/\$\("#logoHome"\)\.addEventListener\("click",e=>\{([\s\S]*?)\n\}\);/)?.[1] || '';
  assert.doesNotMatch(logoClick, /adminLongPress/);
});

test('account icon opens the dialog and admin option reveals the login form', () => {
  const { $, elements } = makeElements();
  const shown = [];
  const accountBody = captureHandler('#accountBtn', 'click');
  assert.ok(accountBody, 'account button click handler exists');
  const openAccount = vm.runInNewContext('(()=>{' + accountBody + '})', {
    $, S: { session: { role: 'client', merchant: null }, merchantProfile: {} },
    showDlg: selector => shown.push(selector),
  });
  openAccount();
  assert.deepEqual(shown, ['#accountDlg']);

  const adminBody = captureHandler('#roleAdminBtn', 'click');
  assert.ok(adminBody, 'admin button click handler exists');
  const revealAdmin = vm.runInNewContext('(()=>{' + adminBody + '})', { $ });
  revealAdmin();
  assert.equal($('#adminLoginForm').hidden, false);
  assert.equal($('#adminAccessHint').hidden, false);
  assert.equal($('#merchantBox').hidden, true);
});

test('actual admin login handler accepts valid test credentials and rejects an invalid password', async () => {
  const loginBody = captureHandler('#adminLoginForm', 'submit');
  assert.ok(loginBody, 'admin login submit handler exists');
  const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
  const email = 'admin-test@dalilna.invalid';
  const password = 'Dalilna-Test-Only-Password!';
  const testAdmin = { email, name: 'Test Admin', hash: digest(password), perms: [] };

  const runLogin = async suppliedPassword => {
    const { $, elements } = makeElements();
    $('#roleAdminBtn').hidden = false;
    $('#admEmail').value = email;
    $('#admPass').value = suppliedPassword;
    const state = {
      admins: [testAdmin],
      session: { role: 'client', adminEmail: '', merchant: null },
      onboarded: false,
    };
    const notices = [];
    const handler = vm.runInNewContext('(async e=>{' + loginBody + '})', {
      $, S: state,
      sha256: async value => digest(value),
      logAction: () => {},
      saveState: () => {},
      syncRoleUI: () => {},
      render: () => {},
      closeDlg: () => {},
      toast: message => notices.push(message),
    });
    await handler({ preventDefault() {} });
    return { state, elements, notices };
  };

  const success = await runLogin(password);
  assert.equal(success.state.session.role, 'admin');
  assert.equal(success.state.session.adminEmail, email);
  assert.equal(success.state.onboarded, true);
  assert.equal(success.elements.get('#roleAdminBtn').hidden, false, 'admin option remains available after login');
  assert.equal(success.notices.at(-1), 'أهلاً بك في لوحة تحكم المشرف');

  const failure = await runLogin('wrong-password');
  assert.equal(failure.state.session.role, 'client');
  assert.match(failure.elements.get('#admLoginErr').textContent, /غير صحيحة/);
});
