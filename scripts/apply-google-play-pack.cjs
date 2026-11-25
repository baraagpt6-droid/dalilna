const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const ar = "لم يتم اعتماد بريد رسمي للدعم والخصوصية بعد. يجب إدخال بريد فعّال ومراقَب قبل النشر.";
const en = "Not configured yet. Add a verified, monitored support and privacy email before publishing.";
function replace(file, fn) { fs.writeFileSync(file, fn(fs.readFileSync(file, "utf8")), "utf8"); }
function contacts(s) {
  return s.replaceAll("[اسم المطور الرسمي]", "Dalilna Team")
    .replaceAll("[البريد الإلكتروني الرسمي]", ar)
    .replaceAll("[Official Developer Name]", "Dalilna Team")
    .replaceAll("[Official Privacy Email]", en);
}
replace("store/index.html", s => contacts(s).replace("اسم المطور: Dalilna Team<br>التواصل: " + ar, "اسم المطور المعروض: Dalilna Team<br>بريد الدعم والخصوصية: غير معتمد بعد. أدخل بريداً فعّالاً قبل النشر."));
const privacy = contacts(fs.readFileSync("privacy.html", "utf8"));
fs.writeFileSync("privacy.html", privacy);
fs.writeFileSync("android/app/src/main/assets/privacy.html", privacy);
const terms = contacts(fs.readFileSync("terms.html", "utf8")).replace("تواصل مع الجهة المسؤولة على " + ar, "لا توجد قناة بريد إلكتروني منشورة حالياً. يجب إدخال بريد فعّال قبل النشر.");
fs.writeFileSync("terms.html", terms);
fs.writeFileSync("android/app/src/main/assets/terms.html", terms);
replace("tests/google-play-readiness.test.cjs", s => s
  .replaceAll('"[اسم المطور الرسمي]"', '"Dalilna Team"')
  .replaceAll('"[البريد الإلكتروني الرسمي]"', '"لم يتم اعتماد بريد رسمي"')
  .replaceAll('"[Official Developer Name]"', '"Dalilna Team"')
  .replaceAll('"[Official Privacy Email]"', '"Not configured yet"')
  .replace("assert.match(landing, /\\[اسم المطور الرسمي\\]/);", "assert.match(landing, /Dalilna Team/);")
  .replace("assert.match(landing, /\\[البريد الإلكتروني الرسمي\\]/);", "assert.match(landing, /غير معتمد بعد/);"));
replace("GOOGLE_PLAY_LAUNCH_CHECKLIST.md", s => s
  .replaceAll("[اسم المطور الرسمي]", "Dalilna Team (display suggestion; confirm legal account owner)")
  .replaceAll("[البريد الإلكتروني الرسمي]", "PENDING — enter a verified monitored support/privacy email before submission"));
if (privacy !== fs.readFileSync("android/app/src/main/assets/privacy.html", "utf8")) throw new Error("Privacy mirror mismatch");
if (terms !== fs.readFileSync("android/app/src/main/assets/terms.html", "utf8")) throw new Error("Terms mirror mismatch");
fs.unlinkSync("scripts/apply-google-play-pack.cjs");
fs.unlinkSync(".github/workflows/apply-google-play-pack.yml");
execFileSync("git", ["config", "user.name", "github-actions[bot]"]);
execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
execFileSync("git", ["add", "-A"]);
execFileSync("git", ["commit", "-m", "chore(play): replace contact placeholders and sync Android policies"]);
execFileSync("git", ["push", "origin", "HEAD"]);
console.log("Updated store and privacy contacts, synced Android assets, and pushed changes.");
