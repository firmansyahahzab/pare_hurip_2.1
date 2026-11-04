import type { Metadata } from "next";
import PageContent from "@/components/land/LandForm";
import { AdminLayout } from "@/components/layout/AdminLayout";
export const metadata: Metadata = { title: "Data Luas Lahan Tanam — Pare Hurip", robots: { index: false, follow: false } };
export default function Page() { return <AdminLayout title="Data Luas Lahan Tanam"><PageContent /></AdminLayout>; }
