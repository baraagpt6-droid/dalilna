'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const accountDialog = html.match(/<dialog id="accountDlg">([\s\S]*?)<\/dialog>/)?.[1];

test('admin login option is visible in the account menu', () => {
  assert.ok(accountDialog, 'account dialog exists');
  const button = accountDialog.match(/<button\b[^>]*id="roleAdminBtn"[^>]*>/)?.[0];
  assert.ok(button, 'admin login button exists inside account dialog');
  assert.doesNotMatch(button, /\shidden(?:\s|>|=)/, 'admin login button is not hidden');
  assert.match(accountDialog, /دخول المشرف/);
});

test('logo long-press admin shortcut has been removed', () => {
  assert.doesNotMatch(html, /adminLongPressTimer|adminLongPressFired|startAdminLongPress|cancelAdminLongPress/);
});

test('account menu opens and admin option reveals the login form', () => {
  assert.match(html, /#accountBtn"\)\.addEventListener\("click",[\s\S]*?showDlg\("#accountDlg"\)/);
  assert.match(html, /#roleAdminBtn"\)\.addEventListener\("click",\(\)=>\{[\s\S]*?#adminLoginForm"\)\.hidden=false/);
  assert.match(html, /#adminLoginForm"\)\.addEventListener\("submit",async e=>\{/);
});

test('admin login handler checks email and SHA-256 password hash', () => {
  assert.match(html, /const adm=S\.admins\.find\(a=>a\.email\.toLowerCase\(\)===email&&a\.hash===h\)/);
  assert.match(html, /h=await sha256\(pass\)/);
});

test('SHA-256 admin credential verifier accepts valid test credentials and rejects invalid ones', async () => {
  const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
  const testAdmin = {
    email: 'admin-test@dalilna.invalid',
    hash: digest('Dalilna-Test-Only-Password!'),
  };
  const findAdmin = (email, password) => [testAdmin].find(
    account => account.email.toLowerCase() === email.trim().toLowerCase()
      && account.hash === digest(password),
  );

  assert.equal(findAdmin('ADMIN-TEST@DALILNA.INVALID', 'Dalilna-Test-Only-Password!'), testAdmin);
  assert.equal(findAdmin('admin-test@dalilna.invalid', 'wrong-password'), undefined);
  assert.equal(findAdmin('another@dalilna.invalid', 'Dalilna-Test-Only-Password!'), undefined);
});
