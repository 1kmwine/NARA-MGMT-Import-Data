const MODEL = 'gemini-flash-lite-latest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Module-scope cache: survives across requests within this server process.
// Keeps repeat calls for the same stats (e.g. re-visiting the same 기준연도,
// or another user loading the page) from burning the free-tier quota again.
const cache = new Map();

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    t1Bullet1: { type: 'STRING' },
    t1Bullet2: { type: 'STRING' },
    t2Bullet1: { type: 'STRING' },
    t2Bullet2: { type: 'STRING' },
  },
  required: ['t1Bullet1', 't1Bullet2', 't2Bullet1', 't2Bullet2'],
};

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY not configured on the server' }, { status: 500 });
  }

  const stats = await req.json();
  const cacheKey = JSON.stringify(stats);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json(hit.bullets);
  }

  const prompt = [
    '너는 나라셀라(와인 수입 유통사)의 경영기획팀 애널리스트다.',
    '아래 와인 수입 통계 JSON을 바탕으로, 경영진 보고서용 한 줄 인사이트 4개를 한국어로 작성해라.',
    '',
    '규칙:',
    '- 각 문장은 반드시 주어진 숫자에 근거해야 하고, 숫자를 문장에 포함해라 (예: +6.7M$, +22.5%).',
    '- 한 문장 60자 내외, 반말/구어체 금지, 보고서체("~함", "~주도", "~유지" 등).',
    '- t1Bullet1/t1Bullet2: "컬러별 연간·상반기 비교" 표(물량/금액/단가/점유율)에 대한 인사이트.',
    '- t2Bullet1/t2Bullet2: "국가별 수입금액" 표(국가×컬러 YoY 증감)에 대한 인사이트.',
    '- 숫자를 지어내지 말고 stats에 있는 값만 사용해라.',
    '',
    'stats:',
    JSON.stringify(stats),
  ].join('\n');

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
  cache.set(cacheKey, { bullets: parsed, at: Date.now() });
  return Response.json(parsed);
}
