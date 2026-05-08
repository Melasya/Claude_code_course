import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

export interface SessionPayload {
  userId: string;
  email: string;
  expiresAt: Date;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

const COOKIE_NAME = "auth-token";

export async function verifySession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
