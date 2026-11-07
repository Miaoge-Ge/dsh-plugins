window.__ModuleLoader__.load({
  id:'@local/session-cost',
  factory(require) {
    const React=require('react'), h=React.createElement;
    let portal; try {portal=require('react-dom').createPortal;} catch {}
    /*__CORE__*/
    /*__CSS__*/

    const NS='session-cost';
    const DASH='\u2014';

    //#region formatting
    const money=n=>{
      if(!Number.isFinite(n)) return DASH;
      if(n>0&&n<1) return '\u00a5'+n.toFixed(4);
      return '\u00a5'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
    };
    const balanceMoney=(n,currency)=>currency==='CNY'?money(n):new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:4}).format(n);
    const count=n=>Number.isFinite(n)?n.toLocaleString('zh-CN'):DASH;
    const compact=n=>Number.isFinite(n)?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n):DASH;
    const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':DASH;
    const clock=t=>t?new Date(t).toLocaleTimeString('zh-CN',{hour12:false}):DASH;
    //#endregion

    //#region icons
    const Svg=({children,...rest})=>h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none','aria-hidden':true,stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round',...rest},children);
    const IconCost=()=>h(Svg,null,h('rect',{x:2.6,y:6.2,width:18.8,height:13.4,rx:3}),h('path',{d:'M2.6 10.4h18.8'}),h('circle',{cx:17.2,cy:14.6,r:1.3,fill:'currentColor',stroke:'none'}));
    const IconRefresh=()=>h(Svg,null,h('path',{d:'M20 11a8 8 0 1 0-.6 4.2'}),h('path',{d:'M20 4.6V11h-6.4'}));
    const IconDownload=()=>h(Svg,null,h('path',{d:'M12 3.8v10.6'}),h('path',{d:'M7.8 10.6 12 14.8l4.2-4.2'}),h('path',{d:'M4.4 19.2h15.2'}));
    const IconEmpty=()=>h(Svg,{width:22,height:22},h('rect',{x:2.8,y:6.4,width:18.4,height:12.8,rx:3}),h('path',{d:'M7 11.6h10M7 14.8h6'}));
    //#endregion

    //#region ledger
    function createLedger(remote) {
      let state={records:[],failures:[],sessions:0,updatedAt:0,rates:{},status:'idle',progress:''}, active, controller;
      const listeners=new Set(),cache=new Map();
      const publish=patch=>{state={...state,...patch};for(const fn of listeners)fn();};
      return {
        setRates:rates=>publish({rates}),summary:options=>summarize(state.records,options,state.rates),
        subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>state,
        refresh() {
          if(active)return active;
          controller=new AbortController(); publish({status:'loading',error:undefined});
          active=loadLedger(remote,{cache,signal:controller.signal,progress:(done,total)=>publish({progress:`${done} / ${total}`})})
            .then(result=>publish({...result,status:'ready',progress:''}))
            .catch(error=>{if(!controller.signal.aborted)publish({status:'error',error:error.message});})
            .finally(()=>{active=undefined;});
          return active;
        },
        dispose(){controller?.abort();listeners.clear();cache.clear();},
      };
    }
    function useLedger(ledger) {
      const state=React.useSyncExternalStore(ledger.subscribe,ledger.getSnapshot,ledger.getSnapshot);
      React.useEffect(()=>{if(!ledger.getSnapshot().updatedAt)void ledger.refresh();const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void ledger.refresh();},60000);return()=>clearInterval(timer);},[ledger]);
      return state;
    }
    //#endregion

    //#region balance
    function useBalance(readAccountBalance) {
      const [state,setState]=React.useState({status:'loading'});
      const generation=React.useRef(0);
      const load=React.useCallback(()=>{
        const request=++generation.current;
        setState(current=>current.status==='ready'?{...current,stale:true}:{status:'loading'});
        Promise.resolve().then(()=>readAccountBalance())
          .then(body=>{if(request===generation.current)setState({status:'ready',body,at:Date.now()});})
          .catch(()=>{if(request===generation.current)setState({status:'error'});});
      },[readAccountBalance]);
      React.useEffect(()=>{
        load();
        const timer=setInterval(()=>{if(document.visibilityState!=='hidden')load();},120000);
        return()=>{clearInterval(timer);generation.current++;};
      },[load]);
      return [state,load];
    }
    function readBalance(state) {
      const body=state?.status==='ready'?state.body:undefined;
      if(!body||body.ok!==true||!Array.isArray(body.infos)||body.infos.length===0)return undefined;
      const info=body.infos.find(entry=>entry.currency==='CNY')??body.infos[0];
      const total=Number(info.totalBalance), granted=Number(info.grantedBalance), topped=Number(info.toppedUpBalance);
      if(!Number.isFinite(total))return undefined;
      return {currency:info.currency??'CNY',total,granted:Number.isFinite(granted)?granted:0,topped:Number.isFinite(topped)?topped:0,available:body.available!==false};
    }
    //#endregion

    //#region dashboard
    function Stat({label,value,note}) {
      return h('div',{className:'dsc-stat'},h('span',null,label),h('strong',null,value),note?h('small',null,note):null);
    }

    function ModelCard({model,total,unpriced}) {
      const pro=/pro/i.test(model.model??'');
      const share=total>0?model.cost/total:0;
      return h('article',{className:'dsc-model'},
        h('div',{className:'dsc-model-head'},
          h('div',{className:'dsc-model-id'},
            h('span',{className:'dsc-badge'},pro?'PRO':'FLS'),
            h('div',null,h('h3',null,model.model),h('small',null,`${model.provider} \u00b7 ${count(model.calls)} \u6b21\u8c03\u7528`)),
          ),
          h('div',{className:'dsc-model-cost'},
            h('strong',null,unpriced?DASH:money(model.cost)),
            h('small',null,total>0?`${pct(share)} \u5360\u6bd4`:unpriced?'\u5f85\u8ba1\u4ef7':'\u2014'),
          ),
        ),
        h('div',{className:'dsc-bar','aria-hidden':true},h('i',{style:{width:`${total>0?Math.max(2,share*100):0}%`}})),
        h('dl',{className:'dsc-buckets'},[
          ['input','\u672a\u7f13\u5b58\u8f93\u5165'],
          ['cacheRead','\u7f13\u5b58\u8bfb\u53d6'],
          ['cacheWrite','\u7f13\u5b58\u5199\u5165'],
          ['output','\u8f93\u51fa'],
        ].map(([key,label])=>h('div',{key,className:'dsc-bucket'},
          h('dt',null,label),
          h('dd',null,compact(model[key]),h('small',null,money(model.costs?.[key]??0))),
        ))),
      );
    }

    function WebCard({web}) {
      return h('article',{className:'dsc-model dsc-model--web'},
        h('div',{className:'dsc-model-head'},
          h('div',{className:'dsc-model-id'},
            h('span',{className:'dsc-badge'},'WEB'),
            h('div',null,
              h('h3',null,'\u7f51\u9875\u641c\u7d22\u4e0e\u6293\u53d6'),
              h('small',null,`\u641c\u7d22 ${count(web.search)} \u6b21 \u00b7 \u6293\u53d6 ${count(web.fetch)} \u6b21`)),
          ),
          h('div',{className:'dsc-model-cost'},
            h('strong',null,money(web.cost)),
            h('small',null,'\u00a50.005 / \u6b21')),
        ),
      );
    }

    function Dashboard({ledger,sessionId,onClose,rateForm,readAccountBalance}) {
      const state=useLedger(ledger);
      const [period,setPeriod]=React.useState('today');
      const [month,setMonth]=React.useState(dateKey(Date.now()).slice(0,7));
      const [rateText,setRateText]=React.useState(null);
      const [rateMessage,setRateMessage]=React.useState('');
      const [balanceState,refreshBalance]=useBalance(readAccountBalance);

      const today=dateKey(Date.now()), currentMonth=today.slice(0,7);
      const todaySummary=ledger.summary({day:today});
      const monthSummary=ledger.summary({month:currentMonth});
      const summary=ledger.summary(period==='today'?{day:today}:period==='month'?{month}:period==='session'?{sessionId}:{});
      const balance=readBalance(balanceState);
      const loading=state.status==='loading', unavailable=!state.updatedAt;
      const unpriced=summary.unpriced+summary.invalid;

      const monthDays=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
      const daily=Array.from({length:monthDays},(_,i)=>ledger.summary({day:`${month}-${String(i+1).padStart(2,'0')}`}));
      const peak=Math.max(...daily.map(day=>day.cost),.00001);
      const hourly=Array.from({length:24},(_,hour)=>ledger.summary({day:today,hour}));
      const hourPeak=Math.max(...hourly.map(slot=>slot.cost),.00001);

      const exportData=()=>{
        const url=URL.createObjectURL(new Blob([toCSV(summary)],{type:'text/csv;charset=utf-8'}));
        const anchor=document.createElement('a');
        anchor.href=url;
        anchor.download=`deepseek-usage-${period==='month'?month:period==='today'?today:period}.csv`;
        anchor.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      };

      const tabs=[['today','\u4eca\u65e5'],['month','\u672c\u6708'],['all','\u5168\u90e8'],...(sessionId?[['session','\u672c\u4f1a\u8bdd']]:[])];

      const balanceNote=balance
        ? `\u5145\u503c ${balanceMoney(balance.topped,balance.currency)} \u00b7 \u8d60\u9001 ${balanceMoney(balance.granted,balance.currency)}`
        : balanceState.status==='loading'?'\u6b63\u5728\u67e5\u8be2\u4f59\u989d'
        : balanceState.body?.reason==='unconfigured'?'未登录 Harness 账户'
        : '\u4f59\u989d\u67e5\u8be2\u5931\u8d25';

      return h('section',{className:'dsc-dashboard','aria-label':'\u7528\u91cf\u4e0e\u6d88\u8d39','aria-busy':loading},
        h('header',{className:'dsc-head'},
          h('div',{className:'dsc-head-main'},
            h('h1',null,'\u7528\u91cf\u4e0e\u6d88\u8d39'),
            h('p',null,state.updatedAt
              ? `\u66f4\u65b0\u4e8e ${clock(state.updatedAt)} \u00b7 \u5df2\u8bfb\u53d6 ${count(state.sessions-state.failures.length)}/${count(state.sessions)} \u4e2a\u4f1a\u8bdd`
              : '\u4ec5\u8bfb\u53d6\u4f60\u6709\u6743\u8bbf\u95ee\u7684\u4f1a\u8bdd'),
          ),
          h('div',{className:'dsc-head-actions'},
            h('button',{type:'button',className:'dsc-btn',onClick:()=>{void ledger.refresh();refreshBalance(true);},disabled:loading},
              h(IconRefresh),loading?'\u8bfb\u53d6\u4e2d\u2026':'\u5237\u65b0'),
            h('button',{type:'button',className:'dsc-btn',onClick:exportData,disabled:unavailable||loading},h(IconDownload),'\u5bfc\u51fa CSV'),
            onClose?h('button',{type:'button',className:'dsc-btn dsc-btn--icon',onClick:onClose,'aria-label':'\u5173\u95ed'},'\u00d7'):null,
          ),
        ),

        h('div',{className:'dsc-hero'},
          h('div',{className:'dsc-hero-main'},
            h('div',{className:'dsc-eyebrow'},`\u4eca\u65e5\u6d88\u8d39 \u00b7 ${today}`),
            h('div',{className:'dsc-hero-value'},unavailable?DASH:money(todaySummary.cost)),
            h('div',{className:'dsc-hero-meta'},
              h('span',null,h('b',null,count(todaySummary.calls)),' \u6b21\u8c03\u7528'),
              h('span',null,h('b',null,compact(todaySummary.totalTokens)),' tokens'),
              h('span',null,'\u7f13\u5b58\u547d\u4e2d ',h('b',null,pct(todaySummary.cacheRate))),
              todaySummary.web.requests>0?h('span',null,'\u68c0\u7d22 ',h('b',null,count(todaySummary.web.requests)),' \u6b21'):null,
              todaySummary.unpriced>0?h('span',null,h('b',null,count(todaySummary.unpriced)),' \u6b21\u672a\u5339\u914d\u5355\u4ef7'):null,
            ),
          ),
          h('div',{className:'dsc-balance'},
            h('span',null,'登录账户余额'),
            h('strong',null,balance?balanceMoney(balance.total,balance.currency):DASH),
            h('small',null,balanceNote),
          ),
        ),

        h('div',{className:'dsc-stats'},
          h(Stat,{label:'\u672c\u6708\u6d88\u8d39',value:unavailable?DASH:money(monthSummary.cost),note:`${currentMonth} \u00b7 ${count(monthSummary.calls)} \u6b21\u8c03\u7528`}),
          h(Stat,{label:'\u672c\u6708 tokens',value:unavailable?DASH:compact(monthSummary.totalTokens),note:`\u8f93\u5165 ${compact(monthSummary.input+monthSummary.cacheRead+monthSummary.cacheWrite)} \u00b7 \u8f93\u51fa ${compact(monthSummary.output)}`}),
          h(Stat,{label:'\u672c\u6708\u7f13\u5b58\u547d\u4e2d',value:unavailable?DASH:pct(monthSummary.cacheRate),note:`\u7f13\u5b58\u8bfb\u53d6 ${compact(monthSummary.cacheRead)} tokens`}),
        ),

        h('div',{className:'dsc-toolbar'},
          h('div',{className:'dsc-tabs',role:'group','aria-label':'\u7edf\u8ba1\u8303\u56f4'},tabs.map(([id,label])=>
            h('button',{type:'button',key:id,'aria-pressed':period===id,onClick:()=>setPeriod(id)},label))),
          h('div',{className:'dsc-toolbar-right'},
            period==='month'?h('input',{type:'month',value:month,max:currentMonth,'aria-label':'\u9009\u62e9\u7edf\u8ba1\u6708\u4efd',onChange:event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))setMonth(event.target.value);}}):null,
          ),
        ),

        loading?h('p',{className:'dsc-notice',role:'status'},`\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u4f1a\u8bdd\u8bb0\u5f55 ${state.progress}${state.updatedAt?' \u00b7 \u4e0b\u65b9\u4e3a\u4e0a\u6b21\u7edf\u8ba1':''}`):null,
        state.status==='error'?h('p',{className:'dsc-notice',role:'alert'},`\u6682\u65f6\u65e0\u6cd5\u66f4\u65b0\uff1a${state.error}\u3002\u8bf7\u68c0\u67e5\u8fde\u63a5\u540e\u91cd\u8bd5\u3002`):null,
        state.failures.length>0?h('p',{className:'dsc-notice',role:'alert'},`${count(state.failures.length)} \u4e2a\u4f1a\u8bdd\u672a\u8bfb\u53d6\u6210\u529f\uff0c\u4e0b\u65b9\u4e3a\u5df2\u8bfb\u53d6\u90e8\u5206\u7684\u7edf\u8ba1\u3002`):null,
        unpriced>0?h('p',{className:'dsc-notice'},`${count(summary.unpriced)} \u6b21\u8c03\u7528\u672a\u5339\u914d\u5355\u4ef7\uff0c${count(summary.invalid)} \u6b21\u8c03\u7528\u7f3a\u5c11\u5b8c\u6574\u7528\u91cf\uff1b\u91d1\u989d\u4ec5\u5305\u542b\u53ef\u8ba1\u4ef7\u90e8\u5206\u3002`):null,

        h('div',{className:'dsc-section'},
          h('div',null,
            h('h2',null,'\u6a21\u578b\u660e\u7ec6'),
            h('p',null,`${count(summary.calls)} \u6b21\u8c03\u7528 \u00b7 ${count(summary.totalTokens)} tokens${summary.web.requests>0?` \u00b7 ${count(summary.web.requests)} \u6b21\u68c0\u7d22`:''}`)),
          h('strong',null,unavailable?DASH:money(summary.cost)),
        ),

        (summary.models.length>0||summary.web.requests>0)
          ? h('div',{className:'dsc-models'},
              summary.models.map(model=>
                h(ModelCard,{key:`${model.provider}/${model.model}`,model,total:summary.cost,unpriced:model.unpriced===model.calls||model.invalid===model.calls})),
              summary.web.requests>0?h(WebCard,{key:'web',web:summary.web}):null)
          : h('div',{className:'dsc-empty'},h(IconEmpty),h('h3',null,unavailable?'\u7b49\u5f85\u7528\u91cf\u8bb0\u5f55':'\u8fd9\u4e2a\u65f6\u6bb5\u8fd8\u6ca1\u6709\u7528\u91cf'),h('p',null,unavailable?'\u8fde\u63a5\u6210\u529f\u540e\u4f1a\u663e\u793a\u7edf\u8ba1\u3002':'\u5b8c\u6210\u4e00\u6b21\u6a21\u578b\u8c03\u7528\u540e\u5237\u65b0\u5373\u53ef\u67e5\u770b\u3002')),

        period==='today'?h('div',{className:'dsc-chart-card'},
          h('div',{className:'dsc-section'},h('h2',null,'\u4eca\u65e5\u5206\u65f6\u6d88\u8d39'),h('p',null,`${today} \u00b7 CNY`)),
          h('div',{className:'dsc-chart dsc-chart--hours',role:'img','aria-label':'\u4eca\u65e5\u9010\u5c0f\u65f6\u6d88\u8d39\u56fe'},hourly.map((slot,index)=>
            h('div',{className:'dsc-day',key:index,title:`${String(index).padStart(2,'0')}:00 \u8d77 \u00b7 ${money(slot.cost)} \u00b7 ${count(slot.calls)} \u6b21`},
              h('i',{style:{height:`${slot.cost?Math.max(2,slot.cost/hourPeak*100):0}%`}}),
              h('span',null,index%4===0?String(index):'')))),
          h('details',{className:'dsc-details'},
            h('summary',null,'\u67e5\u770b\u5206\u65f6\u660e\u7ec6'),
            h('div',{className:'dsc-table-wrap'},h('table',{className:'dsc-table'},
              h('thead',null,h('tr',null,['\u65f6\u6bb5','\u6d88\u8d39','Tokens','\u8c03\u7528'].map(key=>h('th',{key},key)))),
              h('tbody',null,hourly.map((slot,index)=>h('tr',{key:index},
                h('td',null,`${String(index).padStart(2,'0')}:00`),
                h('td',null,money(slot.cost)),
                h('td',null,count(slot.totalTokens)),
                h('td',null,count(slot.calls))))))))):null,

        period==='month'?h('div',{className:'dsc-chart-card'},
          h('div',{className:'dsc-section'},h('h2',null,'\u6bcf\u65e5\u6d88\u8d39'),h('p',null,`${month} \u00b7 CNY`)),
          h('div',{className:'dsc-chart',role:'img','aria-label':`${month} \u6bcf\u65e5\u6d88\u8d39\u56fe`},daily.map((day,index)=>
            h('div',{className:'dsc-day',key:index,title:`${month}-${String(index+1).padStart(2,'0')}\uff1a${money(day.cost)} \u00b7 ${count(day.totalTokens)} tokens \u00b7 ${count(day.calls)} \u6b21`},
              h('i',{style:{height:`${day.cost?Math.max(2,day.cost/peak*100):0}%`}}),
              h('span',null,index===0||(index+1)%5===0?index+1:'')))),
          h('details',{className:'dsc-details'},
            h('summary',null,'\u67e5\u770b\u6bcf\u65e5\u660e\u7ec6'),
            h('div',{className:'dsc-table-wrap'},h('table',{className:'dsc-table'},
              h('thead',null,h('tr',null,['\u65e5\u671f','\u6d88\u8d39','Tokens','\u8c03\u7528'].map(key=>h('th',{key},key)))),
              h('tbody',null,daily.map((day,index)=>h('tr',{key:index},
                h('td',null,`${month}-${String(index+1).padStart(2,'0')}`),
                h('td',null,money(day.cost)),
                h('td',null,count(day.totalTokens)),
                h('td',null,count(day.calls))))))))):null,

        rateForm?h('details',{className:'dsc-rates'},
          h('summary',null,'\u81ea\u5b9a\u4e49\u6a21\u578b\u5355\u4ef7'),
          h('p',null,'\u4e3a\u672a\u8bc6\u522b\u7684\u6a21\u578b\u586b\u5199\u5143 / \u767e\u4e07 tokens \u5355\u4ef7\u3002\u81ea\u5b9a\u4e49\u5355\u4ef7\u4e0d\u4eab\u53d7\u5cf0\u8c37\u6298\u6263\uff0c\u4fdd\u5b58\u540e\u5bf9\u5386\u53f2\u8bb0\u5f55\u91cd\u65b0\u8ba1\u4ef7\u3002\u952e\u540d\u7528\u4e0a\u65b9\u660e\u7ec6\u91cc\u7684 provider/model\u3002'),
          h('textarea',{'aria-label':'\u6a21\u578b\u4ef7\u683c JSON',spellCheck:false,value:rateText??JSON.stringify(state.rates,null,2),placeholder:'{"provider/model":{"input":1,"cacheRead":0.1,"cacheWrite":1,"output":2}}',onChange:event=>setRateText(event.target.value)}),
          h('div',{className:'dsc-rates-actions'},
            h('button',{type:'button',className:'dsc-btn',onClick:async()=>{
              try{
                const rates=parseRates(rateText??JSON.stringify(state.rates));
                const accepted=await rateForm.set('rates',JSON.stringify(rates));
                setRateMessage(accepted?'\u5355\u4ef7\u5df2\u4fdd\u5b58':'\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
              }catch(error){setRateMessage(error.message);}
            }},'\u4fdd\u5b58\u5355\u4ef7'),
            h('span',{role:'status'},rateMessage),
          )):null,

        h('footer',{className:'dsc-foot'},
          h('p',null,state.updatedAt
            ? `\u5df2\u8bfb\u53d6 ${count(state.sessions-state.failures.length)} / ${count(state.sessions)} \u4e2a\u4f1a\u8bdd \u00b7 \u66f4\u65b0\u4e8e ${clock(state.updatedAt)}`
            : '\u4ec5\u5728\u5f53\u524d Harness \u4e2d\u8bfb\u53d6\u4f60\u6709\u6743\u8bbf\u95ee\u7684\u4f1a\u8bdd'),
          h('details',null,
            h('summary',null,'\u8ba1\u4ef7\u89c4\u5219'),
            h('p',null,`\u6bcf\u6b21\u8c03\u7528\u6309\u5b9e\u9645 token \u7528\u91cf \u00d7 \u5b98\u65b9\u5355\u4ef7\u8ba1\u4ef7\uff08${PRICE_VERSION} \u4ef7\u683c\u5feb\u7167\uff09\u3002\u5cf0\u8c37\u4ef7\u6309\u8c03\u7528\u5f00\u59cb\u65f6\u95f4\u5224\u5b9a\uff1a\u5317\u4eac\u65f6\u95f4\u5468\u4e00\u81f3\u5468\u4e94 09:00-12:00\u300114:00-18:00 \u4e3a\u9ad8\u5cf0\uff0c\u5176\u4f59\u65f6\u6bb5\u3001\u5468\u672b\u4e0e\u6cd5\u5b9a\u8282\u5047\u65e5\u4e3a\u7a7a\u95f2\u4ef7\uff08\u9ad8\u5cf0\u7684\u4e00\u534a\uff09\u3002\u81ea\u52a8\u6392\u9664\u5206\u53c9\u7ee7\u627f\u7684\u5386\u53f2\u8bb0\u5f55\uff0c\u91cd\u8bd5\u72ec\u7acb\u8ba1\u4f5c\u4e00\u6b21\u8c03\u7528\u3002`),
            h('p',null,'\u4ec5\u7edf\u8ba1\u4f1a\u8bdd\u65e5\u5fd7\u4e2d\u7684\u6a21\u578b token \u7528\u91cf\uff0c\u52a0\u4e0a\u7f51\u9875\u641c\u7d22\u4e0e\u6293\u53d6\uff085 \u5143 / 1000 \u6b21\u6210\u529f\u8bf7\u6c42\uff0c\u6bcf\u6b21 \u00a50.005\uff09\uff1b\u6807\u9898\u751f\u6210\u7b49\u8c03\u7528\u82e5\u672a\u8bb0\u5165\u5219\u4e0d\u542b\u3002\u5df2\u5220\u9664\u3001\u4e0d\u53ef\u8bbf\u95ee\u6216\u672a\u8fc1\u79fb\u4f1a\u8bdd\u4e0d\u8ba1\u5165\u3002'),
            h('a',{href:PRICE_SOURCE,target:'_blank',rel:'noreferrer'},'\u5b98\u65b9\u4ef7\u683c\u8868 \u2197'),
          ),
        ),
      );
    }
    //#endregion

    //#region dock pill
    function CostDock({ledger,sessionId,useProjection,rateForm,readAccountBalance}) {
      const state=React.useSyncExternalStore(ledger.subscribe,ledger.getSnapshot,ledger.getSnapshot);
      const [open,setOpen]=React.useState(false);
      const panel=React.useRef(null);
      const usage=useProjection('tokenUsage');
      const hasUsage=usage&&Object.values(usage).some(value=>typeof value==='number'&&value>0);

      React.useEffect(()=>{if(hasUsage)void ledger.refresh();},[ledger,usage]);

      React.useEffect(()=>{
        if(!open)return;
        const previous=document.activeElement;
        panel.current?.querySelector('button')?.focus();
        const onKey=event=>{
          if(event.key==='Escape'){setOpen(false);return;}
          if(event.key!=='Tab')return;
          const nodes=[...panel.current.querySelectorAll('button:not(:disabled),input,a,summary')];
          const first=nodes[0],last=nodes.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        };
        document.addEventListener('keydown',onKey);
        return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
      },[open]);

      const today=ledger.summary({day:dateKey(Date.now())});
      const session=ledger.summary({sessionId});
      const label=state.updatedAt?`${money(session.cost)}`:'\u6d88\u8d39';
      const title=state.updatedAt?`\u672c\u4f1a\u8bdd ${money(session.cost)}\uff1b\u4eca\u65e5 ${money(today.cost)}`:'\u7528\u91cf\u4e0e\u6d88\u8d39';

      const modal=open&&h('div',{className:'dsc-backdrop',onPointerDown:event=>{if(event.target===event.currentTarget)setOpen(false);}},
        h('div',{className:'dsc-modal',role:'dialog','aria-modal':true,'aria-label':'\u7528\u91cf\u4e0e\u6d88\u8d39',ref:panel},
          h(Dashboard,{ledger,sessionId,rateForm,readAccountBalance,onClose:()=>setOpen(false)})));

      return h(React.Fragment,null,
        h('span',{className:'dsc-anchor'},
          h('button',{type:'button',className:'dsc-pill','aria-haspopup':'dialog','aria-expanded':open,title,onClick:()=>setOpen(true)},
            h(IconCost),
            h('span',null,label),
            state.updatedAt?h('i',null,'\u00b7'):null,
            state.updatedAt?h('span',null,`\u4eca\u65e5 ${money(today.cost)}`):null,
          )),
        modal&&(portal?portal(modal,document.body):modal));
    }
    //#endregion

    return {inject:['slots','locale','remote','remote.session','configForms'],apply(ctx){
      const ledger=createLedger(ctx.remote.session);
      const readAccountBalance=async()=>{
        const account=ctx.get('remote.account');
        if(!account?.getBalance)return {ok:false,reason:'unconfigured'};
        return normalizeBalance(await account.getBalance({version:'0.2.2-rc.1',locale:ctx.locale.getSnapshot().active,timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60}));
      };
      const rateForm=ctx.configForms.get('session-cost');
      const updateRates=()=>{try{ledger.setRates(parseRates(rateForm.getSnapshot().value?.rates??'{}'));}catch{ledger.setRates({});}};
      ctx.effect(()=>rateForm.subscribe(updateRates));updateRates();
      ctx.effect(()=>()=>ledger.dispose());
      ctx.effect(()=>ctx.locale.register(NS,{zh:{title:'\u7528\u91cf\u4e0e\u6d88\u8d39'},en:{title:'Usage & spending'}}));
      ctx.effect(()=>{const style=document.createElement('style');style.dataset.plugin='@local/session-cost';style.textContent=CSS;document.head.appendChild(style);return()=>style.remove();});
      ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'session-cost',order:6,locale:NS,label:()=>ctx.locale.bind(NS)('title'),inject:()=>({ledger,rateForm,readAccountBalance})},Dashboard));
      ctx.slots.inject('settings.section.icon',()=>ctx.slots.register({name:'settings.section.icon',id:'session-cost'},IconCost));
      ctx.slots.inject('conversation.composer.dock',()=>ctx.slots.register({name:'conversation.composer.dock',id:'cost',order:2,locale:NS,inject:sessionId=>({ledger,sessionId,rateForm,readAccountBalance})},CostDock));
    }};
  },
});
