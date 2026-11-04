import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { EditLand } from "../components/land/LandForm";
const row = { id: "id", kode_wilayah: "001", nama_kecamatan: "Kawalu", periode: "2026-10-01", luas_ha: 25.5, keterangan: "Input tetap tersimpan", created_by: "user", created_at: "" };
test("Form: Batal tidak menyimpan, gagal mempertahankan input, cegah submit ganda, sukses sesudah server", async () => {
 const dom = new JSDOM("<!doctype html><html><body><button id='trigger'>Edit</button><div id='root'></div></body></html>", { url: "http://localhost" });
 Object.defineProperties(globalThis, { window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true }, navigator: { value: dom.window.navigator, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true } });
 // JSDOM tidak mengimplementasikan dialog native; pengujian ini hanya interaksi komponen, bukan focus trap browser.
 dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
 dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
 let writes = 0; let success = 0; let cancelled = 0;
 const originalFetch = globalThis.fetch;
 const root = createRoot(document.getElementById("root")!);
 const props = { row, regions: [{ id: "region", kode_wilayah: "001", nama_kecamatan: "Kawalu", created_at: "" }], onClose: () => { cancelled++; }, onSuccess: () => { success++; } };
 document.getElementById("trigger")!.focus();
 await act(async () => { root.render(<EditLand {...props} />); });
 const cancel = [...document.querySelectorAll("button")].find(b => b.textContent === "Batal")!;
 await act(async () => { cancel.click(); }); assert.equal(cancelled, 1); assert.equal(writes, 0);
 globalThis.fetch = async () => { writes++; return new Response(JSON.stringify({ error: "Konflik periode" }), { status: 409, headers: { "Content-Type": "application/json" } }); };
 await act(async () => { document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
 assert.equal(writes, 1); assert.equal(success, 0); assert.match(document.body.textContent!, /Konflik periode/);
 assert.equal((document.getElementById("land-area") as HTMLInputElement).value, "25.5"); assert.equal((document.getElementById("land-note") as HTMLTextAreaElement).value, row.keterangan); assert.ok(document.querySelector("dialog")?.open);
 let resolveFetch: (r: Response) => void = () => {};
 globalThis.fetch = () => { writes++; return new Promise<Response>(resolve => { resolveFetch = resolve; }); };
 await act(async () => {
  const form = document.querySelector("form")!;
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
 });
 assert.equal(writes, 2); assert.equal(success, 0); assert.ok((document.querySelector("button[type='submit']") as HTMLButtonElement).disabled);
 const cancelEvent = new dom.window.Event("cancel", { cancelable: true });
 await act(async () => { document.querySelector("dialog")!.dispatchEvent(cancelEvent); }); assert.equal(cancelled, 1); assert.ok(cancelEvent.defaultPrevented);
 await act(async () => { resolveFetch(new Response(JSON.stringify({ success: true }), { status: 200 })); }); assert.equal(success, 1);
 await act(async () => root.unmount()); assert.equal(document.activeElement?.id, "trigger"); assert.equal(document.body.style.overflow, "");
 globalThis.fetch = originalFetch; dom.window.close();
});
