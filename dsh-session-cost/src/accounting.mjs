// CNY / million tokens. Verified 2026-11-07 against the official pricing page.
export const PRICE_SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/';
export const PRICE_VERSION = '2026-11-07';
export const TARIFFS = {
  'deepseek-flash': { input: 2, cacheRead: .04, cacheWrite: 2, output: 8 },
  'deepseek-v4-pro': { input: 9, cacheRead: .30, cacheWrite: 9, output: 27 },
};
// Search and Fetch are separate APIs billed per successful request: 5 CNY /
// 1000 requests each, so 0.005 CNY per call.
export const WEB_PRICE = { search: 5 / 1000, fetch: 5 / 1000 };
const WEB_TOOL_KIND = { web_search: 'search', web_fetch: 'fetch' };
const HOLIDAYS = [['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']];
export const dateKey = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
export function isPeak(time) {
  const d = new Date(time + 8 * 3600000), key = dateKey(time), minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const holiday = key.startsWith('2026-') && HOLIDAYS.some(([a,b]) => key.slice(5) >= a && key.slice(5) <= b);
  return !holiday && d.getUTCDay() > 0 && d.getUTCDay() < 6 && ((minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080));
}
export function tariffFor(model, provider = 'deepseek') {
  // Never price an unrelated model merely because its name contains "pro".
  if (!/^(deepseek|deepseek-account|deepseek-official)$/i.test(provider)) return undefined;
  const aliases = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4.1-flash-1017'];
  const key = aliases.includes(model?.toLowerCase()) ? 'deepseek-flash' : model?.toLowerCase();
  return TARIFFS[key];
}
export function normalizeUsage(usage) {
  const result = {};
  for (const [key, field] of Object.entries({input:'inputTokens',cacheRead:'cacheReadTokens',cacheWrite:'cacheWriteTokens',output:'outputTokens'})) {
    const n = usage?.[field] ?? (key === 'input' || key === 'output' ? NaN : 0);
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    result[key] = n;
  }
  if (usage.totalTokens !== undefined && usage.totalTokens !== Object.values(result).reduce((a,b)=>a+b,0)) return undefined;
  return result;
}
export function parseRates(text) {
  const rates = JSON.parse(text);
  if (!rates || Array.isArray(rates) || typeof rates !== 'object') throw new Error('价格表必须是 JSON 对象');
  for (const [name, rate] of Object.entries(rates)) {
    if (!name.includes('/') || !rate || typeof rate !== 'object' || Array.isArray(rate)) throw new Error('键名应为 provider/model');
    for (const key of ['input','cacheRead','cacheWrite','output']) if (typeof rate[key] !== 'number' || !Number.isFinite(rate[key]) || rate[key] < 0) throw new Error('四项单价必须是非负数字（元 / 百万 tokens）');
  }
  return rates;
}
export function priceRecord(record, rates = {}) {
  const key = `${record.provider}/${record.model}`;
  const custom = Object.hasOwn(rates,key) ? rates[key] : undefined;
  const tariff = custom ?? tariffFor(record.model, record.provider);
  if (!tariff || !Number.isFinite(record.time)) return null;
  const multiplier = custom || isPeak(record.time) ? 1 : .5;
  return Object.fromEntries(['input','cacheRead','cacheWrite','output'].map(key => [key, record.tokens[key] * tariff[key] * multiplier / 1e6]));
}
// Keep accounting metadata only: no prompts, responses, paths or credentials.
export function compactEvent(event) {
  const {type,seq,time,data={}} = event;
  if (type === 'assistant/message' || type === 'assistant/attempt') {
    const sample = data.usage ?? [...(data.stream ?? [])].reverse().find(r => r.type === 'chunk' && r.chunk?.type === 'usage')?.chunk.usage;
    const source = data.message?.source;
    return {type,seq,time,data:{turn:data.turn,step:data.step,usage:sample,source:source ? {provider:source.provider,model:source.model} : undefined}};
  }
  if (type === 'request/context') return {type,seq,time,data:{provider:data.provider,model:data.model}};
  if (type === 'step/start' || type === 'llm/retry-started') return {type,seq,time,data:{turn:data.turn,step:data.step}};
  if (type === 'session/end-seed') return {type,seq,time,data:{inherited:data.inherited}};
  // Web tools: the tool NAME and its outcome are enough to bill the request;
  // the query, URL and page body never enter the ledger.
  if (type === 'tool/call') return {type,seq,time,data:{callId:data.callId,name:data.name}};
  if (type === 'tool/result') {
    const message = data.message ?? {};
    return {type,seq,time,data:{callId:message.toolCallId ?? message.source?.callId,failed:message.isError === true}};
  }
  return null;
}
export function foldEvents(events, sessionId) {
  const ordered = [...new Map(events.map(e => [e.seq,e])).values()].sort((a,b)=>a.seq-b.seq);
  const inherited = ordered.filter(e => e.type === 'session/end-seed' && e.data.inherited).at(-1)?.seq ?? -1;
  const rows = new Map(), web = new Map(); let route = {}, attempt = 0, started, stepKey;
  for (const e of ordered) {
    const d = e.data;
    if (e.type === 'request/context') {route = d; continue;}
    if (e.type === 'step/start' || e.type === 'llm/retry-started') {
      const key = `${d.turn}:${d.step}`;
      attempt = e.type === 'llm/retry-started' && key === stepKey ? attempt + 1 : 0;
      stepKey = key; started = e.time; continue;
    }
    if (e.seq <= inherited) continue;
    if (e.type === 'tool/call') {
      const kind = WEB_TOOL_KIND[d.name];
      if (kind && typeof d.callId === 'string') web.set(d.callId, {id:`${sessionId}:web:${d.callId}`,sessionId,kind:'web',tool:kind,time:e.time,failed:false,settled:false});
      continue;
    }
    if (e.type === 'tool/result') {const call = web.get(d.callId); if (call) {call.settled=true;call.failed=d.failed;} continue;}
    if (!['assistant/message','assistant/attempt'].includes(e.type)) continue;
    const key = `${d.turn}:${d.step}`;
    if (key !== stepKey) {stepKey=key; attempt=0; started=undefined;}
    const id = `${sessionId}:${key}:${attempt}`;
    const tokens = normalizeUsage(d.usage);
    if (!tokens) {rows.set(id, {id,sessionId,invalid:true,time:started ?? e.time}); continue;}
    rows.set(id, {id,sessionId,time:started ?? e.time,model:d.source?.model ?? route.model ?? 'unknown',provider:d.source?.provider ?? route.provider ?? 'unknown',tokens});
  }
  return [...rows.values(), ...[...web.values()].filter(call => call.settled && !call.failed)];
}
const hourOf = time => new Date(time + 8 * 3600000).getUTCHours();
export function summarize(records, {day, month, sessionId, hour} = {}, rates = {}) {
  const rows = records.filter(r => (!day || dateKey(r.time) === day) && (!month || dateKey(r.time).startsWith(month)) && (!sessionId || r.sessionId === sessionId) && (hour === undefined || hourOf(r.time) === hour));
  const empty = () => ({cost:0,input:0,cacheRead:0,cacheWrite:0,output:0,totalTokens:0,calls:0,unpriced:0,invalid:0,costs:{input:0,cacheRead:0,cacheWrite:0,output:0,web:0},web:{search:0,fetch:0,requests:0,cost:0}});
  const total = empty(), models = new Map(), days = new Map();
  for (const row of rows) {
    const day = dateKey(row.time);
    if (!days.has(day)) days.set(day, {...empty(),day});
    if (row.kind === 'web') {
      const price = WEB_PRICE[row.tool] ?? 0;
      for (const target of [total, days.get(day)]) {
        target.web[row.tool] += 1;
        target.web.requests += 1;
        target.web.cost += price;
        target.cost += price;
        target.costs.web += price;
      }
      continue;
    }
    const modelKey = `${row.provider ?? 'unknown'}/${row.model ?? 'unknown'}`;
    if (!models.has(modelKey)) models.set(modelKey, {...empty(),model:row.model ?? 'unknown',provider:row.provider ?? 'unknown'});
    const cost = row.invalid ? null : priceRecord(row, rates);
    for (const target of [total, models.get(modelKey), days.get(day)]) {
      target.calls++;
      if (row.invalid) {target.invalid++; continue;}
      if (!cost) target.unpriced++;
      for (const key of ['input','cacheRead','cacheWrite','output']) {
        target[key] += row.tokens[key]; target.totalTokens += row.tokens[key];
        target.costs[key] += cost?.[key] ?? 0; target.cost += cost?.[key] ?? 0;
      }
    }
  }
  total.cacheRate = total.input + total.cacheRead + total.cacheWrite ? total.cacheRead / (total.input + total.cacheRead + total.cacheWrite) : 0;
  return {...total,models:[...models.values()].sort((a,b)=>b.cost-a.cost),days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day))};
}
export function toCSV(summary) {
  const cell = value => '"' + String(typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"','""') + '"';
  const web = summary.web?.requests ? [['deepseek-web','search+fetch',summary.web.requests,0,0,0,0,0,summary.web.cost.toFixed(6),0,0]] : [];
  const rows = [['provider','model','calls','input_tokens','cache_read_tokens','cache_write_tokens','output_tokens','total_tokens','cost_cny','unpriced_calls','invalid_calls'], ...summary.models.map(m=>[m.provider,m.model,m.calls,m.input,m.cacheRead,m.cacheWrite,m.output,m.totalTokens,m.cost.toFixed(6),m.unpriced,m.invalid]), ...web];
  return '\uFEFF' + rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
