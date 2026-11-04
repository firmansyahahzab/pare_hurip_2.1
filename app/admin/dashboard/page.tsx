import type { Metadata } from "next";
import PageContent from "@/components/land/Dashboard";
import { AdminLayout } from "@/components/layout/AdminLayout";
export const metadata: Metadata = { title: "Dashboard — Pare Hurip", robots: { index: false, follow: false } };
export default function Page() { return <AdminLayout title="Dashboard"><PageContent /></AdminLayout>; }
