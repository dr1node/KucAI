type SearchTopic = "general" | "news";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isSearchTopic(value: unknown): value is SearchTopic {
  return value === "general" || value === "news";
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function GET() {
  return Response.json(
    { configured: Boolean(process.env.TAVILY_API_KEY?.trim()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Format permintaan pencarian tidak valid." },
      { status: 400 },
    );
  }

  if (
    !isRecord(payload) ||
    typeof payload.query !== "string" ||
    (payload.apiKey !== undefined && typeof payload.apiKey !== "string") ||
    !isSearchTopic(payload.topic)
  ) {
    return Response.json(
      { error: "Query, API key, atau jenis pencarian tidak valid." },
      { status: 400 },
    );
  }

  const query = payload.query.trim();
  const apiKey =
    process.env.TAVILY_API_KEY?.trim() ||
    (typeof payload.apiKey === "string" ? payload.apiKey.trim() : "");
  if (!query || query.length > 500) {
    return Response.json(
      { error: "Pertanyaan pencarian harus berisi 1–500 karakter." },
      { status: 400 },
    );
  }
  if (!apiKey || apiKey.length > 500) {
    return Response.json(
      {
        error:
          "Pencarian web belum dikonfigurasi. Atur TAVILY_API_KEY di server atau kirim API key pribadi.",
      },
      { status: 400 },
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: payload.topic,
        search_depth: "basic",
        max_results: 3,
        chunks_per_source: 2,
        include_answer: false,
        include_raw_content: "markdown",
        include_published_date: payload.topic === "news",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return Response.json(
      { error: "Tidak dapat menghubungi layanan pencarian. Coba lagi nanti." },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    const message =
      upstreamResponse.status === 401 || upstreamResponse.status === 403
        ? "Tavily menolak API key. Periksa key yang dimasukkan."
        : upstreamResponse.status === 429
          ? "Kuota atau batas permintaan Tavily tercapai."
          : `Layanan pencarian mengembalikan HTTP ${upstreamResponse.status}.`;
    return Response.json({ error: message }, { status: 502 });
  }

  let resultPayload: unknown;
  try {
    resultPayload = await upstreamResponse.json();
  } catch {
    return Response.json(
      { error: "Layanan pencarian mengirim respons yang tidak valid." },
      { status: 502 },
    );
  }

  if (!isRecord(resultPayload) || !Array.isArray(resultPayload.results)) {
    return Response.json(
      { error: "Format hasil pencarian tidak dikenali." },
      { status: 502 },
    );
  }

  const results = resultPayload.results.flatMap((result) => {
    if (
      !isRecord(result) ||
      typeof result.title !== "string" ||
      typeof result.content !== "string"
    ) {
      return [];
    }

    const url = normalizeHttpUrl(result.url);
    if (!url) return [];

    const content =
      typeof result.raw_content === "string" && result.raw_content.trim()
        ? result.raw_content
        : result.content;
    return [
      {
        title: result.title.slice(0, 300),
        url,
        content: content.slice(0, 6000),
        publishedDate:
          typeof result.published_date === "string"
            ? result.published_date.slice(0, 40)
            : null,
      },
    ];
  });

  return Response.json({ query, results });
}
