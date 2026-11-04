import type { Metadata } from "next";
import PageContent from "@/components/land/Regions";
import { AdminLayout } from "@/components/layout/AdminLayout";
export const metadata: Metadata = { title: "Referensi Wilayah — Pare Hurip", robots: { index: false, follow: false } };
export default function Page() { return <AdminLayout title="Referensi Wilayah"><PageContent /></AdminLayout>; }
