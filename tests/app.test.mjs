import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

function getInlineScript() {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(content => content.trim());
  assert.equal(scripts.length, 1, "expected one inline application script");
  return scripts[0];
}

test("the inline JavaScript parses without syntax errors", () => {
  assert.doesNotThrow(() => new vm.Script(getInlineScript(), { filename: "index.html:inline-script" }));
});

test("HTML IDs are unique and every getElementById target exists", () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate HTML IDs can break controls");

  const referencedIds = [...getInlineScript().matchAll(/getElementById\(["']([^"']+)["']\)/g)]
    .map(match => match[1]);
  const missing = [...new Set(referencedIds)].filter(id => !ids.includes(id));
  assert.deepEqual(missing, [], "script references missing HTML IDs");
});

test("personalized-link API errors are announced inside the open dialog", () => {
  assert.match(html, /id="modalMessage"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(getInlineScript(), /modalMessage\.textContent = 'QuietLink could not create your personalised link\.[ ]*'\s*\+/);
  assert.doesNotMatch(
    getInlineScript(),
    /shareMessage\.textContent = 'QuietLink could not create your personalised link\.'/,
    "an error shown behind the open modal is invisible to the user"
  );
});

test("personalized-link submission prevents duplicate requests and restores button state", () => {
  const script = getInlineScript();
  assert.match(script, /if \(isCreatingPersonalizedLink\) return/);
  assert.match(script, /cancelModal\.disabled = true/);
  assert.match(script, /isCreatingPersonalizedLink = false/);
  assert.match(script, /nameForm\.removeAttribute\('aria-busy'\)/);
});

test("the personalize dialog supports focus return, escape, and keyboard focus trapping", () => {
  const script = getInlineScript();
  assert.match(script, /function closeLinkModal\(force\)/);
  assert.match(script, /makeLinkButton\.focus\(\)/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /event\.key === 'Tab'/);
  assert.match(script, /event\.shiftKey && document\.activeElement === first/);
});

test("reduced-motion preference avoids animated GIF rotation and confetti", () => {
  const script = getInlineScript();
  assert.match(html, /id="staticCelebration" hidden/);
  assert.match(script, /if \(prefersReducedMotion\) \{/);
  assert.match(script, /if \(!prefersReducedMotion\) launchConfetti\(\)/);
  assert.match(script, /if \(image\) image\.hidden = true/);
});

test("the QuietLink endpoint and 30-day personalized-link expiry remain configured", () => {
  const script = getInlineScript();
  assert.match(script, /https:\/\/quiet-link\.pages\.dev/);
  assert.match(script, /const QUIETLINK_EXPIRY_SECONDS = 30 \* 24 \* 60 \* 60/);
  assert.match(script, /short\.origin !== QUIETLINK_ORIGIN/);
  assert.match(script, /link\.searchParams\.set\('to', name\)/);
});

test("the README describes the current five-GIF celebration rotation", () => {
  assert.match(readme, /five-GIF bear-love rotation/);
});
