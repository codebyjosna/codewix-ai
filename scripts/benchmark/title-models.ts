// Benchmark Groq chat models for the background "short chat title" job.
//
// Probes chat/completions for each model in a static, verified NIM model list
// (see https://docs.api.nvidia.com/nim/reference/llm-apis) with a deliberately
// long app prompt. Results are written as JSON + Markdown, sorted by latency
// among successful title outputs.
//
// Run:
//   node --env-file=.env scripts/benchmark/title-models.ts --limit 40 --reps 2
//   node --env-file=.env scripts/benchmark/title-models.ts --all --reps 3

const API_BASE = "https://api.groq.com/openai/v1";
const COMPLETIONS_URL = `${API_BASE}/chat/completions`;

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error(
    "Missing GROQ_API_KEY. Run with: node --env-file=.env scripts/benchmark/title-models.ts",
  );
  process.exit(2);
}

// Verified NVIDIA NIM chat-completion model ids (not an exhaustive catalog
// dump like Together's - NIM has no equivalent enriched /v1/models discovery
// endpoint with pricing/context-length, so this list is curated by hand).
const NIM_CHAT_MODELS = [
  "deepseek-ai/deepseek-v4-flash",
  "deepseek-ai/deepseek-v4-pro",
  "google/codegemma-7b",
  "google/gemma-7b",
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.2-1b-instruct",
  "meta/llama-3.2-3b-instruct",
  "meta/llama-3.3-70b-instruct",
  "microsoft/phi-4-mini-instruct",
  "microsoft/phi-4-mini-flash-reasoning",
  "minimaxai/minimax-m2.5",
  "minimaxai/minimax-m2.7",
  "mistralai/mistral-nemotron",
  "mistralai/mixtral-8x7b-instruct",
  "mistralai/mixtral-8x22b-instruct",
  "moonshotai/kimi-k2-instruct",
  "moonshotai/kimi-k2-thinking",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
  "nvidia/nvidia-nemotron-nano-9b-v2",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/nemotron-mini-4b-instruct",
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen2.5-coder-32b-instruct",
  "qwen/qwen3-coder-480b-a35b-instruct",
  "qwen/qwen3-next-80b-a3b-instruct",
  "qwen/qwen3-next-80b-a3b-thinking",
  "qwen/qwq-32b",
  "sarvamai/sarvam-m",
  "stepfun-ai/step-3.5-flash",
  "stockmark/stockmark-2-100b-instruct",
  "upstage/solar-10.7b-instruct",
  "z-ai/glm4.7",
  "z-ai/glm5.1",
  "z-ai/glm-5.2",
];

type CatalogModel = {
  id?: string;
  type?: string;
  display_name?: string;
  organization?: string;
  context_length?: number;
  pricing?: {
    input?: number;
    output?: number;
  };
};

type Outcome =
  | "OK"
  | "BAD_TITLE"
  | "NON_SERVERLESS"
  | "DEPRECATED"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "ERROR";

type Probe = {
  outcome: Outcome;
  status: number | null;
  ms: number;
  title: string;
  detail: string;
};

type Result = {
  id: string;
  displayName: string;
  organization: string;
  contextLength: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  probes: Probe[];
  okCount: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  bestTitle: string;
};

const args = parseArgs(process.argv.slice(2));
const outDir =
  args.out ??
  `tmp/benchmark/title-models/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const reps = numberArg(args.reps, 2);
const concurrency = numberArg(args.concurrency, 6);
const timeoutMs = numberArg(args.timeout, 30_000);
const limit = args.all ? Infinity : numberArg(args.limit, 40);
const ids =
  typeof args.ids === "string"
    ? new Set(args.ids.split(",").map((id) => id.trim()).filter(Boolean))
    : null;
const longPrompt = buildLongPrompt();

await mkdirp(outDir);

const catalog = await fetchCatalog();
const candidates = catalog
  .filter((m) => m.id && m.type === "chat")
  .filter((m) => !ids || ids.has(m.id!))
  .filter((m) => !args.model || m.id!.includes(args.model))
  .sort((a, b) => sortModel(a).localeCompare(sortModel(b)))
  .slice(0, limit);

console.log(
  `Benchmarking ${candidates.length}/${catalog.length} NVIDIA NIM models with ${reps} rep(s), concurrency ${concurrency}.`,
);
console.log(`Long prompt chars: ${longPrompt.length}`);
console.log(`Output: ${outDir}\n`);

const results = await mapLimit(candidates, concurrency, async (model, index) => {
  const probes: Probe[] = [];
  for (let rep = 0; rep < reps; rep += 1) {
    probes.push(await probeTitle(model.id!, longPrompt, timeoutMs));
  }

  const okProbes = probes.filter((p) => p.outcome === "OK");
  const times = okProbes.map((p) => p.ms).sort((a, b) => a - b);
  const result: Result = {
    id: model.id!,
    displayName: model.display_name ?? model.id!,
    organization: model.organization ?? "",
    contextLength: model.context_length ?? null,
    inputPrice: model.pricing?.input ?? null,
    outputPrice: model.pricing?.output ?? null,
    probes,
    okCount: okProbes.length,
    medianMs: median(times),
    minMs: times[0] ?? null,
    maxMs: times.at(-1) ?? null,
    bestTitle: okProbes[0]?.title ?? "",
  };

  const label =
    result.okCount > 0
      ? `${result.medianMs}ms "${result.bestTitle}"`
      : probes.map((p) => p.outcome).join("/");
  console.log(`${String(index + 1).padStart(3)} ${model.id} -> ${label}`);
  return result;
});

const sorted = [...results].sort((a, b) => {
  if (a.medianMs === null && b.medianMs === null) return a.id.localeCompare(b.id);
  if (a.medianMs === null) return 1;
  if (b.medianMs === null) return -1;
  return a.medianMs - b.medianMs;
});

await writeFile(
  `${outDir}/results.json`,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      args: { reps, concurrency, timeoutMs, limit: Number.isFinite(limit) ? limit : "all" },
      promptChars: longPrompt.length,
      results: sorted,
    },
    null,
    2,
  ),
);
await writeFile(`${outDir}/results.csv`, toCsv(sorted));
await writeFile(`${outDir}/report.md`, toMarkdown(sorted));

console.log(`\nTop successful title models:`);
for (const row of sorted.filter((r) => r.okCount > 0).slice(0, 15)) {
  console.log(
    `${String(row.medianMs).padStart(6)}ms  ${row.id}  "${row.bestTitle}"`,
  );
}
console.log(`\nWrote ${outDir}/report.md`);

async function fetchCatalog(): Promise<CatalogModel[]> {
  return NIM_CHAT_MODELS.map((id) => ({
    id,
    type: "chat",
    display_name: id,
    organization: id.split("/")[0],
  }));
}

async function probeTitle(
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<Probe> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const start = performance.now();

  try {
    const res = await fetch(COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 24,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Create a succinct 3-5 word title for this app-building chat. Return only the title.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: ac.signal,
    });
    const text = await res.text();
    const ms = Math.round(performance.now() - start);
    const outcome = classify(res.status, text);

    if (outcome !== "OK") {
      return {
        outcome,
        status: res.status,
        ms,
        title: "",
        detail: shortDetail(text),
      };
    }

    const title = cleanTitle(JSON.parse(text)?.choices?.[0]?.message?.content ?? "");
    const valid = isGoodTitle(title);
    return {
      outcome: valid ? "OK" : "BAD_TITLE",
      status: res.status,
      ms,
      title,
      detail: valid ? "" : `Bad title format: ${title}`,
    };
  } catch (e) {
    const ms = Math.round(performance.now() - start);
    return {
      outcome: (e as Error).name === "AbortError" ? "TIMEOUT" : "NETWORK",
      status: null,
      ms,
      title: "",
      detail: (e as Error).message.slice(0, 240),
    };
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number, bodyText: string): Outcome {
  const text = bodyText.toLowerCase();
  if (status === 200) return "OK";
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (
    /non-serverless model|requires? a dedicated endpoint|create and start a new dedicated endpoint/i.test(
      text,
    )
  ) {
    return "NON_SERVERLESS";
  }
  if (
    /deprecat|decommission|discontinued|no longer|retired|model not found|unknown model|does not exist|is not available|has been removed/i.test(
      text,
    )
  ) {
    return "DEPRECATED";
  }
  if (status === 404) return "DEPRECATED";
  if (status >= 500) return "SERVER_ERROR";
  return "ERROR";
}

function cleanTitle(raw: string) {
  return raw
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .split("\n")
    .at(0)!
    .trim()
    .slice(0, 100);
}

function isGoodTitle(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 7 && title.length <= 80;
}

function shortDetail(text: string) {
  try {
    const json = JSON.parse(text);
    const msg = json?.error?.message ?? json?.message ?? json?.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 240);
  } catch {
    /* not json */
  }
  return text.trim().slice(0, 240);
}

function sortModel(model: CatalogModel) {
  const price = model.pricing?.input ?? 999;
  return `${String(price).padStart(8, "0")}-${model.id}`;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2
    ? values[mid]
    : Math.round((values[mid - 1] + values[mid]) / 2);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toCsv(results: Result[]) {
  const rows = [
    [
      "rank",
      "model",
      "displayName",
      "organization",
      "okCount",
      "medianMs",
      "minMs",
      "maxMs",
      "bestTitle",
      "inputPrice",
      "outputPrice",
      "outcomes",
    ],
    ...results.map((r, i) => [
      String(i + 1),
      r.id,
      r.displayName,
      r.organization,
      String(r.okCount),
      String(r.medianMs ?? ""),
      String(r.minMs ?? ""),
      String(r.maxMs ?? ""),
      r.bestTitle,
      String(r.inputPrice ?? ""),
      String(r.outputPrice ?? ""),
      r.probes.map((p) => p.outcome).join("|"),
    ]),
  ];
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function toMarkdown(results: Result[]) {
  const ok = results.filter((r) => r.okCount > 0);
  const failed = results.filter((r) => r.okCount === 0);
  return [
    "# Title Model Benchmark",
    "",
    `Created: ${new Date().toISOString()}`,
    `Prompt chars: ${longPrompt.length}`,
    `Reps: ${reps}`,
    "",
    "## Fastest Successful Models",
    "",
    "| Rank | Model | Median | OK | Title | Input $/M | Output $/M |",
    "| ---: | --- | ---: | ---: | --- | ---: | ---: |",
    ...ok
      .slice(0, 40)
      .map(
        (r, i) =>
          `| ${i + 1} | \`${r.id}\` | ${r.medianMs}ms | ${r.okCount}/${r.probes.length} | ${escapeMd(r.bestTitle)} | ${r.inputPrice ?? ""} | ${r.outputPrice ?? ""} |`,
      ),
    "",
    "## Failed / Unavailable",
    "",
    "| Model | Outcomes | Detail |",
    "| --- | --- | --- |",
    ...failed.map(
      (r) =>
        `| \`${r.id}\` | ${r.probes.map((p) => p.outcome).join(", ")} | ${escapeMd(r.probes.find((p) => p.detail)?.detail ?? "")} |`,
    ),
    "",
  ].join("\n");
}

function escapeMd(text: string) {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function mkdirp(dir: string) {
  const fs = await import("node:fs/promises");
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(file: string, content: string) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(file, content);
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "all") {
      parsed[key] = true;
    } else {
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function numberArg(value: string | boolean | undefined, fallback: number) {
  if (typeof value !== "string") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildLongPrompt() {
  const base = [
    "Build a comprehensive operating dashboard for an independent design studio.",
    "The app should include a project pipeline, client health cards, weekly capacity planning, invoice status, team mood check-ins, a lightweight CRM, and a notes area.",
    "Make it feel like a real production SaaS workspace rather than a landing page.",
    "Use dense but calm information design, clear hierarchy, keyboard-friendly controls, tabs, filters, charts, and realistic seeded data.",
  ].join(" ");

  const sections = Array.from({ length: 40 }, (_, i) => {
    const week = i + 1;
    return [
      `Week ${week} requirements:`,
      "show active projects with owner, deadline, risk, budget, next milestone, client sentiment, and blockers;",
      "include interaction details such as toggling project status, filtering by owner, selecting a project, and updating notes locally;",
      "keep visual style polished, responsive, and suitable for a professional studio team;",
      "avoid external assets and make every visible detail specific to this studio workflow.",
    ].join(" ");
  }).join("\n\n");

  return `${base}\n\n${sections}`;
}
