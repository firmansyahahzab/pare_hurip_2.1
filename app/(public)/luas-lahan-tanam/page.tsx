import type { Metadata } from "next";
import PublicLandDashboard from "@/components/land/PublicLandDashboard";

export const metadata: Metadata = {
 title: "Luas Lahan Tanam Padi | Pare Hurip 3.0",
 description: "Informasi luas lahan tanam padi Kota Tasikmalaya berdasarkan kecamatan dan periode, bersumber dari data yang dikelola admin.",
 alternates: { canonical: "/luas-lahan-tanam" },
};
export default function LandAreaPage() {
 return <PublicLandDashboard />;
}
