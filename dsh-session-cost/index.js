import z from '@deepseek-ai/schemastery';

// Third-party prices are CNY / million tokens. DeepSeek models are priced by
// accounting.mjs (peak/idle multipliers); these entries only cover providers
// whose prices are not part of the built-in DeepSeek tariff.
export const DEFAULT_RATES = {
  'qwen/qwen3.8-flash': { input: .8, cacheRead: .1, cacheWrite: .8, output: 2.7 },
  'glm/glm5.3-flash': { input: .8, cacheRead: .23, cacheWrite: .8, output: 2.8 },
  'xiaomi/mimo-v2.6-pro': { input: 3, cacheRead: .025, cacheWrite: 3, output: 6 },
  'xiaomi/mimo-v2.6-flash': { input: 1, cacheRead: .02, cacheWrite: 1, output: 2 },
  'minimax/MiniMax-M3.1-Flash': { input: 1, cacheRead: .1, cacheWrite: 1, output: 4 },
};

const BALANCE_TIMEOUT = 8000;

async function resolveSecret(ctx, names) {
  const credentials = ctx.get('credentials');
  for (const name of names) {
    if (credentials) {
      try {
        const found = await credentials.resolve(name);
        if (found?.value) return found.value;
      } catch {}
    }
    const value = process.env?.[name];
    if (value) return value;
  }
}

function amount(value, currency) {
  const number = Number(value);
  return Number.isFinite(number) ? `${currency} ${number.toFixed(2)}` : `${currency} ${value}`;
}

function walletText(body) {
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  if (!infos.length) throw new Error('返回中没有 balance_infos');
  return infos.map(info => {
    const currency = info.currency ?? 'CNY';
    const available = info.total_available ?? info.total_balance ?? info.balance;
    const cash = info.cash_balance ?? info.topped_up_balance;
    const gift = info.gift_balance ?? info.granted_balance;
    const parts = [`可用 ${amount(available, currency)}`];
    if (cash !== undefined) parts.push(`现金 ${amount(cash, currency)}`);
    if (gift !== undefined) parts.push(`赠送 ${amount(gift, currency)}`);
    return parts.join('，');
  }).join('；');
}

function glmText(body) {
  if (body?.success === false || (body?.code !== undefined && Number(body.code) !== 200)) throw new Error(body?.msg ?? `接口返回 code ${body?.code}`);
  const limits = Array.isArray(body?.data?.limits) ? body.data.limits : [];
  if (!limits.length) throw new Error('返回中没有 limits');
  return limits.slice(0, 4).map(limit => {
    const parts = [limit.type ?? '额度'];
    if (limit.percentage !== undefined) parts.push(`已用 ${limit.percentage}%`);
    if (limit.remaining !== undefined) parts.push(`剩余 ${limit.remaining}`);
    if (limit.nextResetTime) {
      const reset = new Date(limit.nextResetTime);
      parts.push(`重置 ${Number.isNaN(reset.getTime()) ? limit.nextResetTime : reset.toLocaleString('zh-CN')}`);
    }
    return parts.join(' ');
  }).join('；');
}

function minimaxText(body) {
  const status = body?.base_resp?.status_code;
  if (status !== undefined && Number(status) !== 0) throw new Error(`接口返回 ${status}：${body?.base_resp?.status_msg ?? '未知错误'}`);
  const data = body?.data ?? body ?? {};
  const fields = Object.entries(data).filter(([key, value]) => typeof value === 'number' && /count|remain|total|usage/i.test(key));
  if (!fields.length) throw new Error('返回中没有可识别的额度字段');
  return fields.slice(0, 6).map(([key, value]) => `${key}=${value}`).join(' · ');
}

async function requestJson(url, key) {
  if (typeof fetch !== 'function') throw new Error('当前 Host 不支持 fetch');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!response.ok) {
      const detail = typeof body === 'object' ? (body?.error?.message ?? body?.message ?? body?.msg) : undefined;
      throw new Error(`HTTP ${response.status}${detail ? `：${detail}` : ''}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const BALANCE_PROVIDERS = [
  {
    id: 'deepseek', label: 'DeepSeek', keys: ['DEEPSEEK_API_KEY'],
    run: async key => walletText(await requestJson('https://api.deepseek.com/user/balance', key)),
  },
  {
    id: 'mimo', label: 'MIMO', keys: ['XIAOMI_API_KEY'],
    run: async key => walletText(await requestJson('https://api.xiaomimimo.com/v1/platform/balance', key)),
  },
  {
    id: 'glm', label: 'GLM', keys: ['GLM_API_KEY', 'ZHIPU_API_KEY', 'ZAI_API_KEY'],
    run: async key => `Coding Plan ${glmText(await requestJson('https://open.bigmodel.cn/api/monitor/usage/quota/limit', key))}`,
  },
  {
    id: 'minimax', label: 'MiniMax', keys: ['MINIMAX_API_KEY'],
    run: async key => `Token Plan ${minimaxText(await requestJson('https://api.minimax.io/v1/token_plan/remains', key))}`,
  },
  { id: 'qwen', label: 'Qwen', message: 'QWEN_API_KEY 没有余额接口；需 qianwen CLI OAuth 或控制台查询' },
  { id: 'hunyuan', label: '腾讯混元', message: '需腾讯云 SecretId/SecretKey 调用财务 API；当前未配置' },
];

async function balanceRows(ctx, providers) {
  const rows = [];
  for (const provider of providers) {
    if (provider.message) {
      rows.push({id: provider.id, label: provider.label, detail: provider.message, status: 'note'});
      continue;
    }
    const key = await resolveSecret(ctx, provider.keys);
    if (!key) {
      rows.push({id: provider.id, label: provider.label, detail: `未配置 ${provider.keys.join(' / ')}`, status: 'missing'});
      continue;
    }
    try {
      rows.push({id: provider.id, label: provider.label, detail: await provider.run(key), status: 'ok'});
    } catch (error) {
      rows.push({id: provider.id, label: provider.label, detail: `查询失败：${error?.message ?? error}`, status: 'error'});
    }
  }
  return rows;
}

async function runBalance(ctx, rawInput) {
  const query = (rawInput ?? '').trim().toLowerCase();
  const selected = query
    ? BALANCE_PROVIDERS.filter(provider => provider.id === query || provider.label.toLowerCase().includes(query))
    : BALANCE_PROVIDERS;
  if (!selected.length) {
    return { kind: 'error', text: `未知厂商：${rawInput}。可用：${BALANCE_PROVIDERS.map(provider => provider.id).join('、')}` };
  }
  const rows = await balanceRows(ctx, selected);
  return {
    kind: 'success',
    text: [
      '厂商余额（实时查询）',
      ...rows.map(row => `${row.label}  ${row.detail}`),
      '',
      '说明：DeepSeek / MIMO 为现金余额；GLM / MiniMax 为套餐额度；Qwen / 混元需要额外凭据。查询失败不会显示为 0。',
    ].join('\n'),
  };
}

async function collectBalances(ctx) {
  return {updatedAt: Date.now(), providers: await balanceRows(ctx, BALANCE_PROVIDERS)};
}

async function writeBalances(ctx, config) {
  const data = await collectBalances(ctx);
  const serialized = JSON.stringify(data);
  // A volatile field can be updated in place through its reference; this keeps
  // transient balances out of the profile file when the runtime supports it.
  const field = config?.balances;
  if (typeof field?.set === 'function') {
    try {
      if (field.get?.() === serialized) return;
      field.set(serialized);
      return;
    } catch {}
  }
  const editor = ctx.get('configEditor');
  const entry = ctx.fiber?.entry;
  if (!editor || !entry) return;
  let previous;
  try { previous = config?.balances?.get?.(); } catch {}
  if (previous === serialized) return;
  await editor.edit(entry, current => ({...current, balances: serialized}));
}

export const Config = z.object({
  rates:z.string().default(JSON.stringify(DEFAULT_RATES)).volatile(),
  balances:z.string().default('{}').volatile(),
});
export function apply(ctx, config) {
  ctx.inject(['settings','commands'], child => {
    child.effect(() => child.commands.register({
      name: 'provider-balance',
      description: '查询模型厂商余额或套餐额度',
      input: { hint: '[deepseek|mimo|glm|minimax|qwen|hunyuan]' },
      handler: invocation => runBalance(ctx, invocation.rawInput),
    }));
    child.effect(() => child.settings.configure({auto:false},ctx.fiber));
  });
  const canUpdateBalances = typeof config?.balances?.set === 'function'
    || (ctx.get('configEditor') && ctx.fiber?.entry);
  if (canUpdateBalances) {
    ctx.effect(() => {
      let disposed = false, running = false;
      const refresh = async () => {
        if (disposed || running) return;
        running = true;
        try { await writeBalances(ctx, config); }
        catch (error) { ctx.logger?.warn?.('session-cost: balance refresh failed', error); }
        finally { running = false; }
      };
      const initial = setTimeout(() => void refresh(), 1500);
      const interval = setInterval(() => void refresh(), 5 * 60 * 1000);
      return () => {
        disposed = true;
        clearTimeout(initial);
        clearInterval(interval);
      };
    });
  }
}
