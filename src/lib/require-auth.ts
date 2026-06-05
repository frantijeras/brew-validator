import { auth } from "./auth";
import { NextResponse } from "next/server";

/**
 * Helper for API routes: checks that the request has a valid session.
 * Returns the session user id if authenticated, or a 401 JSON response.
 */
export async function requireAuth(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, userId: session.user.id };
}
