import { NextResponse } from "next/server";
import { INITIATIVES, DISTRICTS } from "@/lib/seed";

export async function GET() {
  return NextResponse.json({
    city: "Таганрог",
    districts: DISTRICTS.map((d) => ({ id: d.id, name: d.name, center: d.center })),
    initiatives: INITIATIVES.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      category: i.category,
      lng: i.lng,
      lat: i.lat,
      address: i.address,
      districtId: i.districtId,
      votes: i.votes.length,
    })),
  });
}
