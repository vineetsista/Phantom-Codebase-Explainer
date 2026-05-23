import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = (session as { backendId?: string } | null)?.backendId;
  if (!id) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const res = await fetch(`${API_URL}/api/v1/me/analytics`, {
    headers: { "X-User-Id": id },
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
