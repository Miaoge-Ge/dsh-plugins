import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,isPeak,tariffFor,normalizeUsage,compactEvent,foldEvents,summarize,toCSV,parseRates,monthText,dayText,shortDay,dayAxis,addDays,dailyWindow} from '../src/accounting.mjs';
import {loadLedger} from '../src/loader.mjs';
const time=Date.parse('2026-11-06T01:00:00Z');
const usage={inputTokens:1e6,outputTokens:1e6,cacheReadTokens:1e6,cacheWriteTokens:0};
const event=(type,seq,data,t=time)=>({type,seq,time:t,data});
const sample=(seq,model='deepseek-flash',step=1)=>compactEvent(event('assistant/message',seq,{turn:1,step,usage,message:{source:{provider:'deepseek-account',model}}}));
test('Shanghai day/month boundaries and peak windows do not depend on device timezone',()=>{
  assert.equal(dateKey(Date.parse('2026-10-31T16:00:00Z')),'2026-11-01');
  for(const [iso,peak] of [['2026-11-06T00:59:00Z',false],['2026-11-06T01:00:00Z',true],['2026-11-06T04:00:00Z',false],['2026-11-06T06:00:00Z',true],['2026-11-06T10:00:00Z',false],['2026-11-07T02:00:00Z',false],['2026-10-01T02:00:00Z',false]])assert.equal(isPeak(Date.parse(iso)),peak,iso);
});
test('date labels keep month and day ranges instead of producing NaN',()=>{
  assert.equal(monthText('2026-11'),'2026年11月');
  assert.equal(dayText('2026-11-08'),'11月8日');
  assert.equal(dayText('2026-01-05'),'1月5日');
  assert.equal(shortDay('2026-11-06'),'11-06');
  assert.equal(shortDay('2026-01-05'),'01-05');
  assert.equal(dayAxis('2026-11-06'),'11/6');
  assert.equal(dayAxis('2026-01-05'),'1/5');
  assert.equal(addDays('2026-11-01',-1),'2026-10-31');
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(addDays('2024-02-28',1),'2024-02-29');
  assert.deepEqual(dailyWindow([]),{days:[],truncated:false});
  assert.deepEqual(dailyWindow(['2026-11-01','2026-11-03']),{days:['2026-11-01','2026-11-02','2026-11-03'],truncated:false});
  const long=Array.from({length:61},(_,index)=>addDays('2026-09-01',index));
  const window=dailyWindow(long);
  assert.equal(window.days.length,60);
  assert.equal(window.days[0],'2026-09-02');
  assert.equal(window.days.at(-1),'2026-10-31');
  assert.equal(window.truncated,true);
});
test('aliases work while unrelated providers and model substrings stay unpriced',()=>{
  assert.ok(tariffFor('deepseek-v4-flash-vision-exp','deepseek-account'));
  assert.equal(tariffFor('other-pro'),undefined);assert.equal(tariffFor('deepseek-v4-pro','third-party'),undefined);
});
test('invalid and inconsistent counters are not silently charged as zero',()=>{
  assert.equal(normalizeUsage({...usage,inputTokens:-1}),undefined);
  assert.equal(normalizeUsage({...usage,totalTokens:2}),undefined);
  assert.equal(normalizeUsage({}),undefined);
});
test('mixed models preserve their own tariff and cost buckets',()=>{
  const result=summarize(foldEvents([sample(1),sample(2,'deepseek-v4-pro',2)],'s'));
  assert.equal(result.calls,2);assert.equal(result.models.length,2);assert.equal(result.totalTokens,6e6);
  assert.ok(Math.abs(result.cost-46.34)<1e-9);assert.equal(result.costs.output,35);
});
test('attempt final sample replaces partial usage, retries add another call',()=>{
  const partial=compactEvent(event('assistant/attempt',1,{turn:1,step:1,stream:[{type:'chunk',chunk:{type:'usage',usage}}]}));
  let rows=foldEvents([partial,sample(2),sample(2),event('llm/retry-started',3,{turn:1,step:1}),sample(4)],'s');
  assert.equal(rows.length,2);assert.equal(summarize(rows).totalTokens,6e6);
});
test('fork-inherited records are excluded; inherited routing remains available',()=>{
  const rows=foldEvents([event('request/context',0,{provider:'deepseek-account',model:'deepseek-flash'}),sample(1),event('session/end-seed',2,{inherited:true}),event('step/start',3,{turn:2,step:1}),compactEvent(event('assistant/attempt',4,{turn:2,step:1,usage}))],'fork');
  assert.equal(rows.length,1);assert.equal(rows[0].model,'deepseek-flash');
});
test('request started before midnight stays on its request date',()=>{
  const start=Date.parse('2026-11-06T15:59:00Z');const final=sample(2);final.time=start+120000;
  const rows=foldEvents([event('step/start',1,{turn:1,step:1},start),final],'s');
  assert.equal(summarize(rows,{day:'2026-11-06'}).calls,1);assert.equal(summarize(rows,{day:'2026-11-07'}).calls,0);
});
test('unknown models retain tokens but expose incomplete totals',()=>{
  const summary=summarize(foldEvents([sample(1,'unknown-model')],'s'));
  assert.equal(summary.unpriced,1);assert.equal(summary.cost,0);assert.equal(summary.totalTokens,3e6);
  assert.match(toCSV(summary),/cost_cny/);assert.match(toCSV({...summary,models:[{...summary.models[0],model:'=1+2'}]}),/'=1\+2/);
});
test('records without a usable usage sample keep their recorded route',()=>{
  const attempt=compactEvent(event('assistant/attempt',2,{turn:1,step:1,stream:[{type:'chunk',chunk:{type:'finish'}}]}));
  const resumed=foldEvents([event('request/context',1,{provider:'deepseek-account',model:'deepseek-flash'}),attempt],'s');
  assert.equal(resumed.length,1);assert.equal(resumed[0].invalid,true);
  assert.equal(resumed[0].provider,'deepseek-account');assert.equal(resumed[0].model,'deepseek-flash');
  const summary=summarize(resumed);
  assert.equal(summary.invalid,1);assert.equal(summary.calls,1);
  assert.deepEqual(summary.models.map(m=>`${m.provider}/${m.model}`),['deepseek-account/deepseek-flash']);
  const interrupted=compactEvent(event('assistant/message',4,{turn:2,step:1,message:{source:{provider:'xiaomi',model:'mimo-v2.6-pro'}}}));
  const rows=foldEvents([interrupted],'s');
  assert.equal(rows[0].invalid,true);assert.equal(rows[0].model,'mimo-v2.6-pro');assert.equal(rows[0].provider,'xiaomi');
});
test('custom prices persist as validated CNY rates and do not inherit peak discounts',()=>{
  const rates=parseRates('{"deepseek-account/unknown-model":{"input":1,"cacheRead":0.1,"cacheWrite":1,"output":2}}');
  const record=sample(1,'unknown-model');record.time=Date.parse('2026-11-07T02:00:00Z');
  const summary=summarize(foldEvents([record],'s'),{},rates);
  assert.equal(summary.unpriced,0);assert.equal(summary.cost,3.1);
  for(const text of ['null','[]','{"bad":{}}','{"a/b":{"input":-1}}'])assert.throws(()=>parseRates(text));
});
test('web search and fetch bill per successful request only',()=>{
  const call=(seq,callId,name)=>compactEvent(event('tool/call',seq,{callId,name}));
  const result=(seq,callId,failed=false)=>compactEvent(event('tool/result',seq,{message:{toolCallId:callId,isError:failed}}));
  const rows=foldEvents([call(1,'a','web_search'),result(2,'a'),call(3,'b','web_search'),result(4,'b',true),call(5,'c','web_fetch'),result(6,'c'),call(7,'d','read')],'s');
  const summary=summarize(rows);
  assert.equal(summary.web.requests,2);assert.equal(summary.web.search,1);assert.equal(summary.web.fetch,1);
  assert.ok(Math.abs(summary.cost-0.01)<1e-12);assert.equal(summary.calls,0);
  assert.match(toCSV(summary),/search\+fetch/);
  assert.deepEqual(summary.models,[]);
});
test('pending and cancelled web calls are not billed before successful settlement',()=>{
  const pending=compactEvent(event('tool/call',1,{callId:'pending',name:'web_search'}));
  assert.equal(summarize(foldEvents([pending],'s')).cost,0);
  const failed=compactEvent(event('tool/result',2,{message:{toolCallId:'pending',isError:true}}));
  assert.equal(summarize(foldEvents([pending,failed],'s')).cost,0);
});
test('incremental cache reads only the newest page and removes deleted sessions',async()=>{
  const cache=new Map();let reads=0,removed=false;
  const remote={list:async()=>({ok:true,value:{items:removed?[]:[{sessionId:'s'}]}}),events:async()=>{reads++;return{ok:true,value:{cursor:5,hasMore:reads>1,records:[{event:sample(5)}]}};}};
  await loadLedger(remote,{cache});const second=await loadLedger(remote,{cache});assert.equal(second.records.length,1);assert.equal(reads,2);
  removed=true;await loadLedger(remote,{cache});assert.equal(cache.size,0);
});
test('compaction metadata never retains prompts or replay payloads',()=>{
  const e=event('assistant/message',1,{usage,message:{content:'SECRET',source:{provider:'deepseek',model:'deepseek-flash',replayState:'SECRET'}},stream:[]});
  assert.ok(!JSON.stringify(compactEvent(e)).includes('SECRET'));assert.equal(compactEvent(event('user/message',2,{text:'SECRET'})),null);
});
test('loader pins history cut and reads every page; failed sessions are disclosed',async()=>{
  const requests=[];const remote={list:async()=>({ok:true,value:{items:[{sessionId:'s'},{sessionId:'bad',formatStatus:'migration-required'}]}}),events:async request=>{requests.push(request);return {ok:true,value:request.beforeSeq===undefined?{cursor:5,hasMore:true,records:[{event:sample(5,'deepseek-v4-pro',2)}]}:{cursor:5,hasMore:false,records:[{event:sample(1)}]}};}};
  const result=await loadLedger(remote);
  assert.equal(result.records.length,2);assert.equal(result.failures.length,1);assert.equal(requests[1].throughSeq,5);assert.equal(requests[1].beforeSeq,5);
});
test('loader never turns a failed connection into an empty successful ledger',async()=>{
  await assert.rejects(loadLedger({list:async()=>({ok:false,error:{message:'offline'}})}),/offline/);
  const controller=new AbortController();controller.abort();await assert.rejects(loadLedger({list:async()=>({ok:true,value:{items:[{sessionId:'s'}]}})},{signal:controller.signal}));
});
