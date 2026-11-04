import type { Metadata } from "next";
import PageContent from "@/components/land/AdminUsers";
import { AdminLayout } from "@/components/layout/AdminLayout";
export const metadata: Metadata = { title: "Pengguna Admin — Pare Hurip", robots: { index: false, follow: false } };
export default function Page() { return <AdminLayout title="Pengguna Admin"><PageContent /></AdminLayout>; }
