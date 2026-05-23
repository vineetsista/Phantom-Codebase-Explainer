/** DELETE proxy for revoking an API key. */
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const backendId = (session as { backendId?: string } | null)?.backendId;
  if (!backendId) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const res = await fetch(`${API_URL}/api/v1/api-keys/${params.id}`, {
    method: "DELETE",
    headers: { "X-User-Id": backendId },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
