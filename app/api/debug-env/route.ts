import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove after root-causing the missing runtime env vars.
export async function GET() {
  const keys = Object.keys(process.env);

  let listenerResult: unknown = null;
  const host = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_HOST;
  const port = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PORT;
  const path = process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_PATH;
  if (host && port && path) {
    try {
      const res = await fetch(`http://${host}:${port}${path}`, {
        signal: AbortSignal.timeout(3000),
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text.slice(0, 500);
      }
      listenerResult = {
        status: res.status,
        keys:
          parsed && typeof parsed === "object"
            ? Object.keys(parsed as object)
            : parsed,
      };
    } catch (err) {
      listenerResult = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    totalEnvVarCount: keys.length,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    hasTogetherApiKey: !!process.env.TOGETHER_API_KEY,
    nodeEnv: process.env.NODE_ENV ?? null,
    listenerHost: host ?? null,
    listenerPort: port ?? null,
    listenerPath: path ?? null,
    listenerResult,
    handler: process.env._HANDLER ?? null,
    lambdaFunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? null,
    deploymentId: process.env.AWS_AMPLIFY_DEPLOYMENT_ID ?? null,
    execWrapper: process.env.AWS_LAMBDA_EXEC_WRAPPER ?? null,
    lambdaTaskRoot: process.env.LAMBDA_TASK_ROOT ?? null,
    pwd: process.env.PWD ?? null,
    sampleKeys: keys.filter((k) => !k.startsWith("npm_")).slice(0, 40),
  });
}
