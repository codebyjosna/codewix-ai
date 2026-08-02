import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { verifyResetToken, hashPassword } from "@/lib/auth";
import { resetPasswordConfirmSchema, firstIssueMessage } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const parsed = resetPasswordConfirmSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { resetToken, password } = parsed.data;

  const email = await verifyResetToken(resetToken);
  if (!email) {
    return NextResponse.json(
      { error: "Reset link expired, please try again" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
