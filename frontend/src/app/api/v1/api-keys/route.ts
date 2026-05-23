/**
 * Proxy for the API keys CRUD endpoints. Adds X-User-Id from session.
 */
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function withAuth() {
  const session = await getServerSession(authOptions);
  const backendId = (session as { backendId?: string } | null)?.backendId;
  if (!backendId) return null;
  return backendId;
}

export async function GET() {
  const id = await withAuth();
  if (!id) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    headers: { "X-User-Id": id },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const id = await withAuth();
  if (!id) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const body = await req.json();
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": id },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
