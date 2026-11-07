import {compactEvent, foldEvents} from './accounting.mjs';
function unwrap(result) {
  if (!result?.ok) throw new Error(result?.error?.message ?? 'Unable to read usage history');
  return result.value;
}
export async function loadLedger(remote, {signal, progress = () => {}, cache = new Map()} = {}) {
  const items = unwrap(await remote.list({}, signal)).items;
  const ids = new Set(items.map(item=>item.sessionId));
  for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
  const records = [], failures = []; let completed = 0;
  for (const item of items) {
    signal?.throwIfAborted();
    try {
      if (item.formatStatus === 'migration-required') throw new Error('History requires migration');
      const address = item.origin === 'subagent' ? {kind:'subagent',parentSessionId:item.parentSessionId,childSessionId:item.sessionId,mode:'unknown'} : {kind:'session',sessionId:item.sessionId};
      let previous = cache.get(item.sessionId);
      const events = []; let throughSeq, beforeSeq;
      while (true) {
        signal?.throwIfAborted();
        const page = unwrap(await remote.events({address,maxMessages:150,...throughSeq === undefined ? {} : {throughSeq},...beforeSeq === undefined ? {} : {beforeSeq}},signal));
        throughSeq ??= page.cursor;
        if (previous && page.cursor < previous.cursor) previous = undefined;
        for (const record of page.records) {if(previous && record.event.seq<=previous.cursor)continue;const event=compactEvent(record.event); if(event)events.push(event);}
        if (previous && (page.cursor===previous.cursor || page.records.some(r=>r.event.seq<=previous.cursor))) break;
        if (!page.hasMore) break;
        const next = Math.min(...page.records.map(r=>r.event.seq));
        if (!Number.isFinite(next) || (beforeSeq !== undefined && next >= beforeSeq)) throw new Error('History pagination did not advance');
        beforeSeq = next;
      }
      const combined = [...(previous?.events ?? []),...events];
      cache.set(item.sessionId,{events:combined,cursor:throughSeq});
      records.push(...foldEvents(combined,item.sessionId));
    } catch (error) {
      if (signal?.aborted) throw error;
      failures.push({sessionId:item.sessionId,message:error.message});
    }
    progress(++completed,items.length);
  }
  return {records,failures,sessions:items.length,updatedAt:Date.now()};
}
