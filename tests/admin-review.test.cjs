'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

test('admin always has a visible shortcut when review requests are pending', () => {
  assert.match(html, /id="admPendingShortcut"/);
  const renderStart = html.indexOf('function renderAdminPanel(){');
  const renderEnd = html.indexOf('/* Admin Dashboard */', renderStart);
  const panel = html.slice(renderStart, renderEnd > renderStart ? renderEnd : renderStart + 18000);
  assert.match(panel, /pendingShortcut\.hidden=count===0\|\|!hasPerm\("review"\)/);
  assert.match(panel, /يوجد '\+count\+' طلب بانتظار مراجعتك/);
});

test('review shortcut opens the pending tab and scrolls the requests into view', () => {
  const start = html.indexOf('$("#admPendingShortcut").addEventListener("click"');
  assert.ok(start >= 0, 'pending shortcut click handler exists');
  const handler = html.slice(start, html.indexOf('});', start) + 3);
  assert.match(handler, /hasPerm\("review"\)/);
  assert.match(handler, /admTab="pending"/);
  assert.match(handler, /renderAdminPanel\(\)/);
  assert.match(handler, /#admBody/);
});

test('pending listing submissions are queued for review', () => {
  const submitStart = html.indexOf('$("#f").addEventListener("submit"');
  const submitEnd = html.indexOf('/* Ads & Slider */', submitStart);
  const submit = html.slice(submitStart, submitEnd);
  assert.match(submit, /S\.pending\.unshift\(/);
  assert.match(submit, /requestType:"listing"/);
  assert.match(submit, /إرسال طلب للمراجعة/);
});

test('review queue displays shop details and explicit approve/reject actions', () => {
  const start = html.indexOf('}else if(admTab==="pending"){');
  const end = html.indexOf('}else if(admTab==="perms"){', start);
  assert.ok(start >= 0 && end > start, 'pending review panel exists');
  const panel = html.slice(start, end);
  assert.match(panel, /S\.pending\.map/);
  assert.match(panel, /data-papprove=/);
  assert.match(panel, /data-preject=/);
  assert.match(panel, /موافقة ونشر/);
  assert.match(panel, /رفض/);
  assert.match(panel, /رقم التواصل/);
  assert.match(panel, /تاريخ الطلب/);
});

test('approval publishes the listing and rejection removes the pending request', () => {
  const start = html.indexOf('}else if(admTab==="pending"){');
  const end = html.indexOf('}else if(admTab==="perms"){', start);
  const panel = html.slice(start, end);
  assert.match(panel, /S\.pending=S\.pending\.filter/);
  assert.match(panel, /S\.items\.unshift\(published\)/);
  assert.match(panel, /data-preject/);
  assert.match(panel, /logAction\("رفض طلب: "/);
});

test('review tab permission is present in the primary admin account', () => {
  assert.match(html, /\["add","edit","delete","verify","review","ads","fx","perms","logs","backup","block"\]/);
  assert.match(html, /pending:"review"/);
});
