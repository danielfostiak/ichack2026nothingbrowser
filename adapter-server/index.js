const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config();

const PORT = Number(process.env.PORT || 8787);
const STORE_PATH = process.env.ADAPTER_STORE_PATH || path.join(__dirname, 'data', 'adapters.json');
const AUTO_REFRESH = process.env.ADAPTER_AUTO_REFRESH === '1';
const AUTO_GENERATE = process.env.ADAPTER_AUTO_GENERATE === '1';
const MISS_MODE = (process.env.ADAPTER_MISS_MODE || 'async').toLowerCase();
const AUTO_RECURSIVE = process.env.ADAPTER_AUTO_RECURSIVE === '1';
const RECURSIVE_MAX_ITER = Number(process.env.ADAPTER_RECURSIVE_MAX_ITER || '4');
const ADAPTER_TTL_MS = Number(process.env.ADAPTER_TTL_MS || String(6 * 60 * 60 * 1000));
const MAX_HTML_BYTES = Number(process.env.ADAPTER_MAX_HTML_BYTES || String(200_000));

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

let store = { adapters: [] };
const inflight = new Map();

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    store = JSON.parse(raw);
    console.log(`[adapter-server] loaded ${store.adapters?.length || 0} adapters`);
  } catch (error) {
    console.error('[adapter-server] failed to load store', error);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('[adapter-server] failed to save store', error);
  }
}

function normalizeUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function matchesSpec(spec, url) {
  const match = spec.match || {};
  if (match.hostContains && match.hostContains.length > 0) {
    const ok = match.hostContains.some((host) => url.hostname.toLowerCase().includes(host.toLowerCase()));
    if (!ok) return false;
  }
  if (match.pathPrefix && match.pathPrefix.length > 0) {
    const ok = match.pathPrefix.some((prefix) => url.pathname.startsWith(prefix));
    if (!ok) return false;
  }
  if (match.urlRegex && match.urlRegex.length > 0) {
    const ok = match.urlRegex.some((pattern) => {
      try {
        return new RegExp(pattern).test(url.toString());
      } catch {
        return false;
      }
    });
    if (!ok) return false;
  }
  return true;
}

function pickAdapter(candidates, templateHint) {
  const filtered = templateHint
    ? candidates.filter((spec) => (spec.template || '').toLowerCase() === templateHint.toLowerCase())
    : candidates.slice();

  if (filtered.length === 0) return null;

  return filtered.sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function findAdapter(url, templateHint) {
  const candidates = (store.adapters || []).filter((spec) => matchesSpec(spec, url));
  return pickAdapter(candidates, templateHint);
}

function upsertAdapter(spec) {
  const now = new Date().toISOString();
  const entry = { ...spec, updatedAt: now };
  const idx = (store.adapters || []).findIndex((item) => item.id && item.id === spec.id);
  if (idx >= 0) {
    store.adapters[idx] = entry;
  } else {
    store.adapters.push(entry);
  }
  saveStore();
  console.log(`[adapter-server] stored adapter id=${entry.id || 'unknown'} template=${entry.template || 'unknown'}`);
  return entry;
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') return { ok: false, error: 'spec missing' };
  if (!spec.template) return { ok: false, error: 'template missing' };
  if (['list', 'news', 'shopping'].includes(spec.template)) {
    if (!spec.itemSelector) return { ok: false, error: 'itemSelector missing' };
    if (!spec.fields || typeof spec.fields !== 'object') {
      return { ok: false, error: 'fields missing' };
    }
  }
  return { ok: true };
}

function getDefaultCriteria(template) {
  const base = {
    minItems: 6,
    requiredFields: {
      title: 0.7,
      href: 0.7
    },
    minContentChars: 400
  };

  if (template === 'shopping') {
    return {
      ...base,
      requiredFields: {
        ...base.requiredFields,
        price: 0.3
      }
    };
  }

  if (template === 'news') {
    return {
      ...base,
      requiredFields: {
        ...base.requiredFields,
        source: 0.2,
        time: 0.2
      }
    };
  }

  return base;
}

function mergeCriteria(template, criteria) {
  const defaults = getDefaultCriteria(template);
  if (!criteria) return defaults;
  return {
    ...defaults,
    ...criteria,
    requiredFields: {
      ...defaults.requiredFields,
      ...(criteria.requiredFields || {})
    }
  };
}

async function fetchHtml(url) {
  console.log(`[adapter-server] fetching html for ${url}`);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  const text = await res.text();
  return text.slice(0, MAX_HTML_BYTES);
}

async function generateAndStore(url, htmlOverride) {
  const key = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const task = (async () => {
    console.log(`[adapter-server] generating adapter (single pass) for ${url}`);
    const html = htmlOverride || await fetchHtml(url);
    const spec = await generateAdapterSpec(url, html);
    return upsertAdapter(spec);
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

async function generateRecursiveAndStore(url, htmlOverride, options = {}) {
  const key = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const task = (async () => {
    console.log(`[adapter-server] generating adapter (recursive) for ${url}`);
    const html = htmlOverride || await fetchHtml(url);
    const result = await generateAdapterSpecRecursive(url, html, {
      ...options,
      maxIterations: options.maxIterations || RECURSIVE_MAX_ITER
    });
    console.log(`[adapter-server] recursive generation done for ${url} iterations=${result.iterations} ok=${result.report?.ok}`);
    return upsertAdapter(result.spec);
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('missing openai api key');
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  const model = process.env.OPENAI_MODEL || 'gpt-5.2-chat-latest';
  const maxCompletionTokens = Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || '1200');
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxCompletionTokens,
      temperature: 0.2,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`openai error: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildPrompt(url, html, options = {}) {
  const { templateHint, modeLabel, searchBox, evaluation, previousSpec, criteria, iteration } = options;
  const systemGuide = `you are generating a json adapter spec for boring browser.\nreturn json only.\n\nformat:\n{\n  "id": "site-name",\n  "template": "list|news|shopping|article",\n  "match": {"hostContains": ["example.com"], "pathPrefix": ["/news"]},\n  "modeLabel": "search",\n  "title": {"selector": "title", "source": "text"},\n  "itemSelector": ".result",\n  "fields": {\n    "title": {"selector": ".title", "source": "text"},\n    "href": {"selector": "a", "attr": "href", "absolute": true},\n    "image": {"selector": "img", "attr": "src", "absolute": true},\n    "meta": {"selector": ".meta", "source": "text"}\n  },\n  "searchBox": true,\n  "maxItems": 60\n}\n\nuse selectors that exist in the html. keep keys lowercase.\n`; 

  const hints = [
    templateHint ? `template hint: ${templateHint}` : null,
    modeLabel ? `modeLabel hint: ${modeLabel}` : null,
    typeof searchBox === 'boolean' ? `searchBox hint: ${searchBox}` : null,
    criteria ? `criteria: ${JSON.stringify(criteria)}` : null,
    iteration ? `iteration: ${iteration}` : null
  ].filter(Boolean).join('\n');

  const feedback = [
    evaluation ? `evaluation report:\n${JSON.stringify(evaluation, null, 2)}` : null,
    previousSpec ? `previous spec (revise it):\n${JSON.stringify(previousSpec, null, 2)}` : null
  ].filter(Boolean).join('\n\n');

  return `${systemGuide}\nurl: ${url}\n${hints ? `${hints}\n` : ''}html (truncated):\n${html}\n${feedback ? `\n${feedback}\n` : ''}`;
}

async function generateAdapterSpec(url, html, options = {}, attempt = 1, errorHint = '') {
  const prompt = buildPrompt(url, html, {
    ...options,
    evaluation: options.evaluation ? options.evaluation : undefined,
    previousSpec: options.previousSpec ? options.previousSpec : undefined,
    iteration: options.iteration ? options.iteration : undefined
  });

  const raw = await callOpenAI(`${prompt}${errorHint ? `\nvalidation error: ${errorHint}\nfix and return json only.` : ''}`);
  const spec = extractJson(raw);
  if (!spec) {
    if (attempt < 2) return generateAdapterSpec(url, html, options, attempt + 1, 'json parse failed');
    throw new Error('could not parse adapter json');
  }
  const validation = validateSpec(spec);
  if (!validation.ok) {
    if (attempt < 2) return generateAdapterSpec(url, html, options, attempt + 1, validation.error);
    throw new Error(`invalid spec: ${validation.error}`);
  }
  return spec;
}

function extractFieldValue($, $scope, fieldSpec, fieldName, baseUrl) {
  if (!fieldSpec) return undefined;
  const spec = typeof fieldSpec === 'string' ? { selector: fieldSpec } : fieldSpec;
  const selector = spec.selector;
  const $node = selector ? $scope.find(selector).first() : $scope;
  if ($node.length === 0) return undefined;

  let value;
  if (spec.attr) {
    value = $node.attr(spec.attr);
  } else if (spec.source === 'html') {
    value = $node.html();
  } else {
    value = $node.text();
  }

  if (!value) return undefined;
  let finalValue = String(value).trim();

  if (spec.regex) {
    try {
      const match = finalValue.match(new RegExp(spec.regex));
      if (match) {
        finalValue = match[1] || match[0];
      }
    } catch {
      // ignore regex errors
    }
  }

  const shouldAbsolute =
    typeof spec.absolute === 'boolean'
      ? spec.absolute
      : fieldName === 'href' || fieldName === 'image';

  if (shouldAbsolute) {
    try {
      finalValue = new URL(finalValue, baseUrl).toString();
    } catch {
      // ignore invalid urls
    }
  }

  return finalValue || undefined;
}

function evaluateSpecAgainstHtml(spec, html, options = {}) {
  const { templateHint, criteria, url } = options;
  const $ = cheerio.load(html);
  const baseUrl = url ? new URL(url) : new URL('https://example.com');
  const effectiveCriteria = mergeCriteria(spec.template, criteria);
  const report = {
    ok: true,
    template: spec.template,
    issues: [],
    counts: {}
  };

  if (templateHint && spec.template !== templateHint) {
    report.ok = false;
    report.issues.push(`template mismatch (expected ${templateHint}, got ${spec.template})`);
  }

  if (['list', 'news', 'shopping'].includes(spec.template)) {
    if (!spec.itemSelector) {
      report.ok = false;
      report.issues.push('itemSelector missing');
      return report;
    }

    const items = [];
    $(spec.itemSelector).each((_idx, el) => {
      const $el = $(el);
      const data = {};
      if (spec.fields) {
        Object.keys(spec.fields).forEach((field) => {
          data[field] = extractFieldValue($, $el, spec.fields[field], field, baseUrl);
        });
      }
      items.push(data);
    });

    const maxItems = effectiveCriteria.maxItems || spec.maxItems || 60;
    const trimmed = items.slice(0, maxItems);
    report.counts.items = trimmed.length;

    const minItems = effectiveCriteria.minItems || 4;
    if (trimmed.length < minItems) {
      report.ok = false;
      report.issues.push(`found ${trimmed.length} items (< ${minItems})`);
    }

    const required = effectiveCriteria.requiredFields || {
      title: 0.6,
      href: 0.6
    };

    Object.keys(required).forEach((field) => {
      const total = trimmed.length || 1;
      const present = trimmed.filter((item) => item[field]).length;
      const rate = present / total;
      report.counts[`${field}Rate`] = Number(rate.toFixed(2));
      if (rate < required[field]) {
        report.ok = false;
        report.issues.push(`${field} coverage ${Math.round(rate * 100)}% (< ${Math.round(required[field] * 100)}%)`);
      }
    });

    if (spec.template === 'shopping' && !required.price && !required.brand) {
      const priceRate = trimmed.filter((item) => item.price).length / (trimmed.length || 1);
      report.counts.priceRate = Number(priceRate.toFixed(2));
      if (priceRate < 0.2) {
        report.issues.push('low price coverage');
      }
    }
  }

  if (spec.template === 'article') {
    const content = extractFieldValue($, $.root(), spec.content, 'content', baseUrl) || '';
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    report.counts.contentLength = plainText.length;
    const minChars = effectiveCriteria.minContentChars || 400;
    if (plainText.length < minChars) {
      report.ok = false;
      report.issues.push(`content too short (${plainText.length} < ${minChars})`);
    }
  }

  return report;
}

async function generateAdapterSpecRecursive(url, html, options = {}) {
  const maxIterations = options.maxIterations || 4;
  let lastSpec = null;
  let lastReport = null;

  for (let i = 1; i <= maxIterations; i += 1) {
    const spec = await generateAdapterSpec(url, html, {
      templateHint: options.templateHint,
      modeLabel: options.modeLabel,
      searchBox: options.searchBox,
      criteria: options.criteria,
      previousSpec: lastSpec,
      evaluation: lastReport,
      iteration: i
    });

    const report = evaluateSpecAgainstHtml(spec, html, {
      templateHint: options.templateHint,
      criteria: options.criteria,
      url
    });

    if (report.ok) {
      return { spec, report, iterations: i };
    }

    lastSpec = spec;
    lastReport = report;
  }

  return { spec: lastSpec, report: lastReport, iterations: maxIterations };
}

app.get('/adapter', async (req, res) => {
  const url = req.query.url;
  const templateHint = req.query.template;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
  const parsed = normalizeUrl(url);
  if (!parsed) return res.status(400).json({ error: 'invalid url' });

  const adapter = findAdapter(parsed, typeof templateHint === 'string' ? templateHint : undefined);
  if (adapter) {
    console.log(`[adapter-server] cache hit for ${parsed.toString()}`);
    const updatedAt = adapter.updatedAt ? new Date(adapter.updatedAt).getTime() : 0;
    if (AUTO_REFRESH && updatedAt && Date.now() - updatedAt > ADAPTER_TTL_MS) {
      generateAndStore(parsed.toString())
        .catch((error) => console.error('[adapter-server] refresh failed', error));
    }
    return res.json(adapter);
  }

  if (AUTO_GENERATE) {
    console.log(`[adapter-server] cache miss for ${parsed.toString()}`);
    const runGeneration = async () => {
      if (AUTO_RECURSIVE) {
        return generateRecursiveAndStore(parsed.toString(), null, {
          templateHint: typeof templateHint === 'string' ? templateHint : undefined
        });
      }
      return generateAndStore(parsed.toString());
    };

    if (MISS_MODE === 'sync') {
      try {
        const stored = await runGeneration();
        return res.json(stored);
      } catch (error) {
        console.error('[adapter-server] auto-generate failed', error);
      }
    } else {
      runGeneration()
        .catch((error) => console.error('[adapter-server] async generate failed', error));
      return res.status(202).json({ error: 'adapter not found', generating: true });
    }
  }

  res.status(404).json({ error: 'adapter not found' });
});

app.post('/generate', async (req, res) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
  const parsed = normalizeUrl(url);
  if (!parsed) return res.status(400).json({ error: 'invalid url' });

  try {
    const html = req.body?.html || await fetchHtml(parsed.toString());
    const spec = await generateAdapterSpec(parsed.toString(), html, {
      templateHint: req.body?.template,
      modeLabel: req.body?.modeLabel,
      searchBox: req.body?.searchBox,
      criteria: req.body?.criteria
    });
    const stored = upsertAdapter(spec);
    res.json(stored);
  } catch (error) {
    console.error('[adapter-server] generate failed', error);
    res.status(500).json({ error: 'generation failed' });
  }
});

app.post('/generate-recursive', async (req, res) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
  const parsed = normalizeUrl(url);
  if (!parsed) return res.status(400).json({ error: 'invalid url' });

  try {
    console.log(`[adapter-server] manual recursive generate for ${parsed.toString()}`);
    const html = req.body?.html || await fetchHtml(parsed.toString());
    const result = await generateAdapterSpecRecursive(parsed.toString(), html, {
      templateHint: req.body?.template,
      modeLabel: req.body?.modeLabel,
      searchBox: req.body?.searchBox,
      criteria: req.body?.criteria,
      maxIterations: req.body?.maxIterations
    });

    const stored = result?.spec ? upsertAdapter(result.spec) : null;
    res.json({
      adapter: stored,
      evaluation: result.report,
      iterations: result.iterations
    });
  } catch (error) {
    console.error('[adapter-server] recursive generate failed', error);
    res.status(500).json({ error: 'generation failed' });
  }
});

app.post('/adapters', (req, res) => {
  const spec = req.body;
  const validation = validateSpec(spec);
  if (!validation.ok) return res.status(400).json({ error: validation.error });
  const stored = upsertAdapter(spec);
  res.json(stored);
});

app.get('/adapters', (_req, res) => {
  res.json({ adapters: store.adapters });
});

loadStore();

app.listen(PORT, () => {
  console.log(`[adapter-server] running on port ${PORT}`);
});
