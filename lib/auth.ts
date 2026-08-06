import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { getPrisma } from "@/lib/prisma";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_MAX_AGE = 60 * 10; // 10 minutes
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET env var is required in production");
    }
    return new TextEncoder().encode("dev-only-insecure-secret");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Fixed hash used to compare against when a user isn't found, so login
// timing doesn't leak whether an email is registered.
export const DUMMY_PASSWORD_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Vf.dS0mHYPS8ZO7lHFmqx0hVLnKmS";

// Fetch the current tokenVersion for a user. Returns null if user not found.
async function getUserTokenVersion(userId: string): Promise<number | null> {
  const prisma = getPrisma();
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  return row?.tokenVersion ?? null;
}

// Bump the tokenVersion for a user, invalidating all existing sessions.
export async function invalidateUserSessions(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

export async function createSession(userId: string) {
  const tokenVersion = (await getUserTokenVersion(userId)) ?? 0;
  const token = await new SignJWT({ sub: userId, v: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    // H3: validate that the tokenVersion in the JWT still matches the DB.
    // If the user reset their password (which bumps tokenVersion), the JWT
    // is stale and must be rejected.
    const tokenV = typeof payload.v === "number" ? payload.v : 0;
    const dbV = await getUserTokenVersion(userId);
    if (dbV === null || dbV !== tokenV) return null;

    return userId;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  try {
    const prisma = getPrisma();
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    // A transient DB error shouldn't crash pages that just want to know
    // whether someone is signed in (e.g. header/nav); treat as signed out.
    console.error("getCurrentUser: failed to load user", err);
    return null;
  }
}

// Short-lived token proving OTP-verified ownership of an email, used to
// authorize the "set new password" step without re-sending a code.
// Embeds the current tokenVersion so that once the password is reset (which
// bumps the version), this token can no longer be reused (H2: single-use).
export async function createResetToken(email: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { tokenVersion: true },
  });
  const tokenVersion = user?.tokenVersion ?? 0;
  return new SignJWT({ email, purpose: "reset", v: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifyResetToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "reset" || typeof payload.email !== "string") {
      return null;
    }
    // H2: reject if the tokenVersion no longer matches the DB — the password
    // was already reset since this token was issued.
    const tokenV = typeof payload.v === "number" ? payload.v : 0;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== tokenV) return null;

    return payload.email;
  } catch {
    return null;
  }
}

function generateOtpCode(): string {
  // Use a cryptographically secure random integer (not Math.random).
  // randomInt(min, max) returns an integer in [min, max).
  return String(randomInt(100000, 1000000));
}

export type OtpPurpose = "signup" | "reset";

export async function issueOtp(email: string, purpose: OtpPurpose) {
  const prisma = getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  const lastOtp = await prisma.otpCode.findFirst({
    where: { email: normalizedEmail, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (lastOtp) {
    const secondsSinceLast =
      (Date.now() - lastOtp.createdAt.getTime()) / 1000;
    if (secondsSinceLast < OTP_RESEND_SECONDS) {
      return {
        ok: false as const,
        retryAfter: Math.ceil(OTP_RESEND_SECONDS - secondsSinceLast),
      };
    }
  }

  const code = generateOtpCode();

  // Invalidate all prior unused OTPs for this email+purpose so only the
  // newest code is valid. Without this, every code issued in the last 10
  // minutes remains independently valid (audit finding M2).
  await prisma.otpCode.updateMany({
    where: { email: normalizedEmail, purpose, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      email: normalizedEmail,
      code,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return { ok: true as const, code };
}

export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
) {
  const prisma = getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  const otp = await prisma.otpCode.findFirst({
    where: { email: normalizedEmail, purpose, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false as const, error: "No active code found" };
  if (otp.expiresAt < new Date()) {
    return { ok: false as const, error: "Code expired" };
  }

  // M3: atomically claim a wrong-attempt slot only if attempts < cap.
  // This prevents the TOCTOU race where N concurrent wrong guesses each
  // read attempts=4 and never hit the cap.
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false as const, error: "Too many attempts" };
  }

  if (otp.code !== code) {
    // Conditional increment: only increments if still under the cap.
    await prisma.otpCode.updateMany({
      where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, error: "Incorrect code" };
  }

  // M3: atomically claim the OTP. updateMany returns count=1 only for the
  // winner; concurrent losers get count=0 and are rejected.
  const claimed = await prisma.otpCode.updateMany({
    where: { id: otp.id, used: false },
    data: { used: true },
  });
  if (claimed.count !== 1) {
    return { ok: false as const, error: "Code already used" };
  }

  return { ok: true as const };
}
