"use client";
export class ApiError extends Error {
 constructor(message: string, public fields: Record<string, string> = {}) { super(message); }
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
 let res: Response;
 try { res = await fetch(url, { cache: "no-store", ...init }); }
 catch { throw new ApiError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi."); }
 const body = await res.json().catch(() => ({}));
 if (!res.ok) throw new ApiError(body.error ?? "Permintaan gagal.", body.fields ?? {});
 return body as T;
}
export function send<T>(url: string, method: string, data: unknown) {
 return api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
export async function download(url: string, filename: string) {
 const res = await fetch(url, { cache: "no-store" });
 if (!res.ok) { const b = await res.json().catch(() => ({})); throw new ApiError(b.error ?? "Unduhan gagal."); }
 const blob = await res.blob(); const href = URL.createObjectURL(blob); const a = document.createElement("a");
 a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export const message = (e: unknown) => e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.";
