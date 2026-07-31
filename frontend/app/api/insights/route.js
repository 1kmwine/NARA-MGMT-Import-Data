const MODEL = 'gemini-flash-lite-latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Module-scope cache: survives across requests within this server process.
// Keeps repeat calls for the same stats (e.g. re-visiting the same year, or
// another user loading the page) from burning the free-tier quota again.
const cache = new Map();

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    bullet1: { type: 'STRING' },
    bullet2: { type: 'STRING' },
  },
  required: ['bullet1', 'bullet2'],
};

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY not configured on the server' }, { status: 500 });
  }

  const { stats, instruction, force } = await req.json();
  const cacheKey = JSON.stringify(stats);
  const skipCache = force || !!instruction;

  if (!skipCache) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return Response.json(hit.bullets);
    }
  }

  const prompt = [
    '너는 나라셀라(와인 수입 유통사)의 경영기획팀 애널리스트다.',
    '아래 통계 JSON을 바탕으로, 경영진 보고서용 한 줄 인사이트 2개를 한국어로 작성해라.',
    '',
    '규칙:',
    '- 각 문장은 반드시 주어진 숫자에 근거해야 하고, 숫자를 문장에 포함해라.',
    '- 한 문장 60자 내외, 반말/구어체 금지, 보고서체("~함", "~주도", "~유지" 등).',
    '- 숫자를 지어내지 말고 stats에 있는 값만 사용해라.',
    instruction ? '- 추가 지시사항(반드시 반영): ' + instruction : '',
    '',
    'stats:',
    JSON.stringify(stats),
  ].filter(Boolean).join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    return Response.json({ error: 'gemini request failed', status: res.status, detail: errText }, { status: 502 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* fallthrough */ }

  if (!parsed) {
    return Response.json({ error: 'failed to parse gemini response', raw: text ?? data }, { status: 502 });
  }
  // Instruction-biased results are session-local — don't let them become the
  // generic cached answer for plain (no-instruction) requests.
  if (!instruction) cache.set(cacheKey, { bullets: parsed, at: Date.now() });
  return Response.json(parsed);
}
