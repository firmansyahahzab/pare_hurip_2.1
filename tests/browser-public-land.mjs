// QA lokal: jalankan aplikasi terlebih dahulu, lalu node tests/browser-public-land.mjs.
// API dicegat dengan PostgreSQL lokal berisi fixture; tidak memakai database pengguna.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

const origin = process.env.QA_ORIGIN || "http://localhost:3000";
const browserPath = process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const artifactDir = path.resolve("artifacts");
const db = new PGlite();
let browser, socket;
const pending = new Map();
let id = 0;
const errors = [];
let failRequest = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(artifactDir, { recursive: true });

try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
 for (const file of ["supabase/000_schema_awal_database_kosong.sql", "supabase/migrations/001_luas_tanam.sql", "supabase/migrations/002_luas_tanam_public.sql"]) await db.exec(await readFile(file, "utf8"));
 const admin = "22222222-2222-4222-8222-222222222222";
 await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'fixture@test.invalid','{\"parehurip_admin\":true}')", [admin]);
 const names = ["Cihideung", "Tawang", "Indihiang", "Cipedes", "Bungursari", "Mangkubumi", "Purbaratu", "Tamansari", "Kawalu", "Cibeureum"];
 for (let i = 0; i < names.length; i++) {
  const code = String(i + 1).padStart(3, "0");
  await db.query("INSERT INTO public.kecamatan(kode_wilayah,nama_kecamatan) VALUES($1,$2)", [code, "Kecamatan " + names[i]]);
  for (let month = 1; month <= 12; month++) await db.query("INSERT INTO public.luas_lahan_tanam(kode_wilayah,periode,luas_ha,created_by) VALUES($1,$2,$3,$4)", [code, `2024-${String(month).padStart(2,"0")}-01`, ((i + 2) * (month === 6 ? 13 : (month % 4 + 2))) / 10, admin]);
 }
 await db.exec("SET ROLE anon");

 browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9337", "--remote-allow-origins=http://localhost:9337", "--user-data-dir=" + path.resolve(".browser-qa"), "about:blank"], { windowsHide: true, stdio: "ignore" });
 const browserError = new Promise((_, reject) => browser.once("error", reject));
 let target;
 for (let n = 0; n < 100; n++) {
  try { target = (await (await fetch("http://127.0.0.1:9337/json", { signal: AbortSignal.timeout(1000) })).json()).find(item => item.type === "page"); if (target) break; } catch {}
  await Promise.race([delay(200), browserError]);
 }
 if (!target) throw new Error("Browser QA tidak tersedia.");
 socket = new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
 const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id;
  const timeout = setTimeout(() => { pending.delete(current); reject(new Error(method + " timed out")); }, 60000);
  pending.set(current, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id: current, method, params }));
 });
 socket.onmessage = async event => {
  const packet = JSON.parse(event.data);
  if (packet.id) {
   const item = pending.get(packet.id);
   if (item) { clearTimeout(item.timeout); pending.delete(packet.id); packet.error ? item.reject(new Error(JSON.stringify(packet.error))) : item.resolve(packet.result); }
  } else if (packet.method === "Runtime.exceptionThrown") errors.push(packet.params.exceptionDetails.exception?.description || packet.params.exceptionDetails.text);
  else if (packet.method === "Fetch.requestPaused") {
   try {
    const query = new URL(packet.params.request.url).searchParams;
    const result = await db.query("SELECT public.ph_public_lahan_dashboard($1,$2,$3) AS data", [query.get("year") ? Number(query.get("year")) : null, query.get("month") ? Number(query.get("month")) : null, query.get("district") || null]);
    await send("Fetch.fulfillRequest", { requestId: packet.params.requestId, responseCode: failRequest ? 503 : 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(failRequest ? { error: "Gangguan uji koneksi" } : result.rows[0].data)).toString("base64") });
   } catch (error) { errors.push(String(error)); await send("Fetch.failRequest", { requestId: packet.params.requestId, errorReason: "Failed" }); }
  }
 };
 const evaluate = async expression => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
 };
 const waitFor = async expression => {
  for (let n = 0; n < 240; n++) { try { if (await evaluate(expression)) return; } catch (error) { if (n === 239) throw error; } await delay(250); }
  throw new Error("Tidak terpenuhi: " + expression);
 };
 const choose = async (elementId, value) => evaluate(`(() => { const el = document.getElementById(${JSON.stringify(elementId)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
 const clickText = text => evaluate(`[...document.querySelectorAll("button")].find(el => el.textContent.trim() === ${JSON.stringify(text)}).click()`);
 const screenshot = async name => {
  const { cssContentSize, cssLayoutViewport } = await send("Page.getLayoutMetrics");
  const width = cssLayoutViewport.clientWidth;
  const height = cssLayoutViewport.clientHeight;
  const mobile = width < 640;
  // Resize before capture so responsive SVGs settle at the screenshot dimensions.
  await send("Emulation.setDeviceMetricsOverride", { width, height: Math.ceil(cssContentSize.height), deviceScaleFactor: 1, mobile });
  await delay(700);
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(artifactDir, name), Buffer.from(result.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await delay(250);
 };
 await send("Page.enable");
 await send("Runtime.enable");
 await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/public/land*" }] });
 await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1920, deviceScaleFactor: 1, mobile: false });
 await send("Page.addScriptToEvaluateOnNewDocument", { source: 'localStorage.setItem("theme","light");document.cookie="theme=light;path=/";' });
 await send("Page.navigate", { url: origin + "/luas-lahan-tanam" });
 await waitFor('document.querySelectorAll("article").length === 4 && !document.querySelector("[aria-busy=true]")');
 await delay(1200);
 assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
 assert.equal(await evaluate('document.querySelector("#public-land-year").value'), "2024");
 assert.equal(await evaluate('[...document.querySelectorAll(".recharts-surface")].every(el => el.getBoundingClientRect().width > 900)'), true);
 assert.equal(await evaluate('document.querySelectorAll(".recharts-label-list .recharts-label").length'), 10);
 await screenshot("luas-tanam-desktop-fixture.png");
 await evaluate("document.querySelector('button[aria-label=\"Halaman berikutnya\"]').click()");
 await waitFor('document.body.textContent.includes("Menampilkan 6–10")');
 await choose("public-land-month", "6");
 await choose("public-land-district", "009");
 await clickText("Terapkan Filter");
 await waitFor('document.querySelector("article strong")?.textContent === "13 ha" && !document.querySelector("[aria-busy=true]")');
 assert.equal(await evaluate('document.querySelectorAll("article")[1].querySelector("strong").textContent'), "1");
 await evaluate("(() => { const el = document.querySelector('select[aria-label=\"Jenis grafik\"]'); el.value = 'line'; el.dispatchEvent(new Event('change', {bubbles:true})); })()");
 await waitFor('!!document.querySelector(".recharts-line")');
 await clickText("Reset");
 await waitFor('document.querySelector("#public-land-month").value === "" && !document.querySelector("[aria-busy=true]")');
 await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
 await delay(500);
 assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
 await evaluate("document.querySelector('button[aria-label=\"Buka menu\"]').click()");
 assert.equal(await evaluate('document.querySelector("#public-mobile-menu").inert'), false);
 assert.equal(await evaluate("!!document.querySelector('#public-mobile-menu a[href=\"/luas-lahan-tanam\"]')"), true);
 await evaluate("document.querySelector('button[aria-label=\"Tutup menu\"]').click()");
 await screenshot("luas-tanam-mobile-fixture.png");
 await evaluate("document.querySelector('button[aria-label=\"Aktifkan mode gelap\"]').click()");
 await waitFor('document.documentElement.classList.contains("dark")');
 await screenshot("luas-tanam-dark-fixture.png");
 failRequest = true;
 await clickText("Perbarui data");
 await waitFor('document.body.textContent.includes("Gangguan uji koneksi")');
 failRequest = false;
 await clickText("Coba lagi");
 await waitFor('document.querySelectorAll("article").length === 4 && !document.querySelector("[aria-busy=true]")');
 await db.exec("RESET ROLE; DELETE FROM public.luas_lahan_tanam; SET ROLE anon;");
 await clickText("Perbarui data");
 await waitFor('document.querySelector("article strong")?.textContent === "Belum ada data" && !document.querySelector("[aria-busy=true]")');
 assert.equal(await evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Unduh Data").disabled'), true);
 assert.deepEqual(errors, []);
 console.log("Browser QA passed: desktop/mobile/dark, filter, reset, pagination, chart switch, retry and empty data. Screenshots use test fixtures.");
} finally {
 if (socket?.readyState === WebSocket.OPEN) {
  socket.send(JSON.stringify({ id: ++id, method: "Browser.close" }));
  socket.close();
 }
 for (const item of pending.values()) clearTimeout(item.timeout);
 if (browser) browser.kill();
 await db.close();
}
