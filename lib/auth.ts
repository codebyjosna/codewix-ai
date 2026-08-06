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

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
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
    return typeof payload.sub === "string" ? payload.sub : null;
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
export async function createResetToken(email: string) {
  return new SignJWT({ email, purpose: "reset" })
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
  if (otp.attempts >= 5) {
    return { ok: false as const, error: "Too many attempts" };
  }

  if (otp.code !== code) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, error: "Incorrect code" };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return { ok: true as const };
}
