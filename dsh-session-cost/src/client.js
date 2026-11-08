window.__ModuleLoader__.load({
  id:'@local/session-cost',
  factory(require) {
    const React=require('react'), h=React.createElement;
    let portal; try {portal=require('react-dom').createPortal;} catch {}
    /*__CORE__*/
    /*__CSS__*/

    const NS='session-cost', DASH='\u2014';
    let popoverSeq=0;

    //#region formatting
    const pad=n=>String(n).padStart(2,'0');
    const count=n=>Number.isFinite(n)?n.toLocaleString('zh-CN'):DASH;
    const amount=n=>{
      if(!Number.isFinite(n))return DASH;
      if(n>0&&n<1)return n.toFixed(4);
      return n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
    };
    const money=n=>Number.isFinite(n)?'\u00a5'+amount(n):DASH;
    const compact=n=>Number.isFinite(n)?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n):DASH;
    const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':DASH;
    const cacheHit=summary=>summary&&summary.input+summary.cacheRead+summary.cacheWrite>0?pct(summary.cacheRate):DASH;
    const balanceMoney=(n,currency)=>currency==='CNY'?money(n):new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:4}).format(n);
    // Accounting is anchored to Beijing time; display follows the same clock so
    // the numbers match the day/peak boundaries no matter where the app runs.
    const beijing=time=>new Date(time+8*3600000);
    const clock=time=>time?pad(beijing(time).getUTCHours())+':'+pad(beijing(time).getUTCMinutes()):DASH;
    const daysInMonth=key=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).getUTCDate();
    //#endregion

    //#region icons
    const Svg=({size=14,children,...rest})=>h('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none','aria-hidden':true,stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round',...rest},children);
    const IconCost=props=>h(Svg,props,h('rect',{x:2.7,y:6.2,width:18.6,height:13.3,rx:3}),h('path',{d:'M2.7 10.5h18.6'}),h('circle',{cx:17.1,cy:14.6,r:1.25,fill:'currentColor',stroke:'none'}));
    const IconRefresh=props=>h(Svg,props,h('path',{d:'M20 11.2a8 8 0 1 0-.35 3.3'}),h('path',{d:'M20 4.6v6.6h-6.6'}));
    const IconDownload=props=>h(Svg,props,h('path',{d:'M12 4v10.4'}),h('path',{d:'M7.9 10.5 12 14.6l4.1-4.1'}),h('path',{d:'M4.8 19.2h14.4'}));
    const IconChevron=props=>h(Svg,props,h('path',{d:'m9.2 5.6 6.2 6.4-6.2 6.4'}));
    const IconEmpty=props=>h(Svg,{size:20,...props},h('path',{d:'M4 19V9.5M9.3 19V5M14.7 19v-6.5M20 19V8'}),h('path',{d:'M3 19h18'}));
    //#endregion

    //#region ledger
    function createLedger(remote) {
      let state={records:[],failures:[],sessions:0,updatedAt:0,rates:{},status:'idle',progress:null,error:undefined};
      let active, busy=false, controller, timer, soon, trailing=false;
      const listeners=new Set(), cache=new Map(), summaries=new Map();
      const publish=(patch,resetSummaries=true)=>{
        state={...state,...patch};
        if(resetSummaries)summaries.clear();
        for(const fn of listeners)fn();
      };
      const refresh=()=>{
        if(active)return active;
        if(soon){clearTimeout(soon);soon=undefined;}
        trailing=false;
        controller=new AbortController();
        busy=true;
        // Status-only update: records and rates are unchanged, so keep the
        // folded summaries and let the panel render at once.
        publish({status:'loading',error:undefined,progress:null},false);
        let reportedAt=0;
        // A large ledger reports once per session; keep the progress text live
        // without re-rendering the whole dashboard on every completed read.
        const report=(done,total)=>{
          const now=Date.now();
          if(done<total&&now-reportedAt<150)return;
          reportedAt=now;
          publish({progress:{done,total}},false);
        };
        active=loadLedger(remote,{cache,signal:controller.signal,progress:report})
          .then(result=>publish({...result,status:'ready',progress:null}))
          .catch(error=>{if(!controller.signal.aborted)publish({status:'error',error:error.message,progress:null});})
          .finally(()=>{
            busy=false;active=undefined;
            // Tokens that arrived during the scan are not in its snapshot; run
            // one quiet trailing scan instead of waiting for the minute timer.
            if(trailing){trailing=false;if(listeners.size>0)refreshSoon(2000);}
          });
        return active;
      };
      // Streaming tokens arrive far faster than a full ledger read; coalesce
      // them into one trailing refresh instead of starting a scan per chunk.
      const refreshSoon=(delay=1500)=>{
        if(busy){trailing=true;return;}
        if(soon)return;
        soon=setTimeout(()=>{soon=undefined;void refresh();},delay);
      };
      const tick=()=>{if(document.visibilityState!=='hidden')void refresh();};
      const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
      return {
        setRates:rates=>publish({rates}),
        // One folded summary per filter, reused across the hero, chart, table and
        // dock until the ledger or the rates actually change.
        summary:options=>{
          const key=JSON.stringify(options??{});
          let result=summaries.get(key);
          if(!result){result=summarize(state.records,options,state.rates);summaries.set(key,result);}
          return result;
        },
        subscribe(fn){
          listeners.add(fn);
          if(listeners.size===1){timer=setInterval(tick,60000);document.addEventListener('visibilitychange',onVisible);}
          return ()=>{
            listeners.delete(fn);
            if(listeners.size===0){clearInterval(timer);timer=undefined;document.removeEventListener('visibilitychange',onVisible);}
          };
        },
        getSnapshot:()=>state,
        refresh,refreshSoon,
        dispose(){
          controller?.abort();
          trailing=false;
          if(soon)clearTimeout(soon);
          if(timer){clearInterval(timer);timer=undefined;}
          document.removeEventListener('visibilitychange',onVisible);
          listeners.clear();cache.clear();summaries.clear();
        },
      };
    }
    function useLedger(ledger,maxAge=0) {
      const state=React.useSyncExternalStore(ledger.subscribe,ledger.getSnapshot,ledger.getSnapshot);
      // Opening the full panel is an explicit request for current numbers; the
      // small popover accepts a few seconds of cache instead of rescanning.
      React.useEffect(()=>{
        const updatedAt=ledger.getSnapshot().updatedAt;
        if(!updatedAt||maxAge===0||Date.now()-updatedAt>maxAge)void ledger.refresh();
      },[ledger,maxAge]);
      return state;
    }
    //#endregion

    //#region balance
    function useBalance(readAccountBalance) {
      const [state,setState]=React.useState({status:'loading'});
      const generation=React.useRef(0);
      const load=React.useCallback(()=>{
        const request=++generation.current;
        setState(current=>current.status==='ready'?{...current,stale:false}:{status:'loading'});
        Promise.resolve().then(()=>readAccountBalance())
          .then(body=>{if(request===generation.current)setState({status:'ready',body});})
          .catch(()=>{if(request===generation.current)setState(current=>current.status==='ready'?{...current,stale:true}:{status:'error'});});
      },[readAccountBalance]);
      React.useEffect(()=>{
        void load();
        const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void load();},120000);
        return ()=>{clearInterval(timer);generation.current++;};
      },[load]);
      return [state,load];
    }
    function readBalance(state) {
      const body=state?.status==='ready'?state.body:undefined;
      if(!body||body.ok!==true||!Array.isArray(body.infos)||body.infos.length===0)return undefined;
      const info=body.infos.find(entry=>entry.currency==='CNY')??body.infos[0];
      const total=Number(info.totalBalance), granted=Number(info.grantedBalance), topped=Number(info.toppedUpBalance);
      if(!Number.isFinite(total))return undefined;
      return {currency:info.currency??'CNY',total,granted:Number.isFinite(granted)?granted:0,topped:Number.isFinite(topped)?topped:0};
    }
    //#endregion

    //#region primitives
    function IconButton({label,onClick,disabled,className='',children}) {
      return h('button',{type:'button',className:`dsc-icon-btn ${className}`.trim(),title:label,'aria-label':label,onClick,disabled},children);
    }

    function Trend({kind,points,truncated}) {
      const peak=points.reduce((best,point)=>point.cost>best.cost?point:best,{cost:0});
      const max=Math.max(peak.cost,.000001);
      const axisEvery=kind==='hour'?6:Math.max(1,Math.ceil(points.length/6));
      const caption=peak.cost>0
        ? `${truncated?'\u6700\u8fd1 60 \u5929 \u00b7 ':''}\u5cf0\u503c ${kind==='hour'?`${pad(peak.slot)}:00`:shortDay(peak.key)} \u00b7 ${money(peak.cost)}`
        : '\u6682\u65e0\u6d88\u8d39';
      return h('div',{className:'dsc-trend'},
        h('div',{className:'dsc-trend-head'},
          h('h2',null,kind==='hour'?'\u5206\u65f6\u6d88\u8d39':'\u6bcf\u65e5\u6d88\u8d39'),
          h('p',null,caption)),
        h('div',{className:'dsc-chart',role:'img','aria-label':kind==='hour'?'\u5206\u65f6\u6d88\u8d39\u56fe':'\u6bcf\u65e5\u6d88\u8d39\u56fe'},points.map(point=>
          h('div',{className:'dsc-col'+(point.now?' is-now':''),key:point.key,title:`${point.title} \u00b7 ${money(point.cost)} \u00b7 ${count(point.tokens)} tokens \u00b7 ${count(point.calls)} \u6b21`},
            h('i',{style:{height:`${point.cost?Math.max(2,point.cost/max*100):0}%`}})))),
        h('div',{className:'dsc-axis','aria-hidden':'true'},points.map((point,index)=>
          h('span',{key:point.key},index%axisEvery===0?point.axis:'\u00a0'))),
        h('details',{className:'dsc-table-details'},
          h('summary',null,kind==='hour'?'\u9010\u65f6\u660e\u7ec6':'\u9010\u65e5\u660e\u7ec6'),
          h('div',{className:'dsc-table-wrap'},h('table',{className:'dsc-table'},
            h('thead',null,h('tr',null,['\u65f6\u6bb5','\u6d88\u8d39','Tokens','\u8c03\u7528'].map(key=>h('th',{key},key)))),
            h('tbody',null,points.map(point=>h('tr',{key:point.key},
              h('td',null,kind==='hour'?`${pad(point.slot)}:00`:point.key),
              h('td',null,money(point.cost)),
              h('td',null,count(point.tokens)),
              h('td',null,count(point.calls)))))))));
    }

    // A small anchored surface, never a full-screen modal. It portals to the
    // body because the docked composer clips fixed descendants.
    function Popover({id,anchorRef,label,onClose,children}) {
      const panel=React.useRef(null);
      const focused=React.useRef(false);
      const skipRestore=React.useRef(false);
      const close=React.useRef(onClose);
      close.current=onClose;
      const [position,setPosition]=React.useState(null);
      React.useLayoutEffect(()=>{
        const place=()=>{
          const rect=anchorRef.current?.getBoundingClientRect();
          if(!rect)return;
          const width=Math.min(340,window.innerWidth-24);
          const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
          const above=rect.top-12;
          const next=above>=220
            ?{left,width,bottom:window.innerHeight-rect.top+8,maxHeight:Math.max(200,above-8)}
            :{left,width,top:rect.bottom+8,maxHeight:Math.max(200,window.innerHeight-rect.bottom-20)};
          setPosition(current=>current&&['left','width','bottom','top','maxHeight'].every(key=>current[key]===next[key])?current:next);
        };
        place();
        window.addEventListener('resize',place);
        window.addEventListener('scroll',place,true);
        const observer=typeof ResizeObserver==='function'?new ResizeObserver(place):null;
        if(observer&&anchorRef.current)observer.observe(anchorRef.current);
        return ()=>{
          window.removeEventListener('resize',place);
          window.removeEventListener('scroll',place,true);
          observer?.disconnect();
        };
      },[anchorRef]);
      React.useEffect(()=>{
        const previous=document.activeElement;
        const onDown=event=>{
          if(panel.current?.contains(event.target))return;
          if(anchorRef.current?.contains(event.target))return;
          skipRestore.current=true;
          close.current();
        };
        const onKey=event=>{if(event.key==='Escape'){event.preventDefault();close.current();}};
        document.addEventListener('pointerdown',onDown,true);
        document.addEventListener('keydown',onKey);
        return ()=>{
          document.removeEventListener('pointerdown',onDown,true);
          document.removeEventListener('keydown',onKey);
          if(!skipRestore.current)previous?.focus?.();
        };
      },[anchorRef]);
      React.useEffect(()=>{
        if(position&&!focused.current){focused.current=true;panel.current?.focus();}
      },[position]);
      if(!position)return null;
      const body=h('div',{className:'dsc-pop',id,role:'dialog','aria-label':label,tabIndex:-1,ref:panel,
        onBlur:event=>{
          if(event.currentTarget.contains(event.relatedTarget))return;
          if(event.relatedTarget&&anchorRef.current?.contains(event.relatedTarget))return;
          skipRestore.current=true;
          close.current();
        },
        style:{left:position.left,width:position.width,maxHeight:position.maxHeight,...(position.bottom!==undefined?{bottom:position.bottom}:{top:position.top})}},children);
      return portal?portal(body,document.body):body;
    }
    //#endregion

    //#region dashboard
    const RANGE_LABEL={today:'\u4eca\u65e5\u6d88\u8d39',month:'\u672c\u6708\u6d88\u8d39',all:'\u7d2f\u8ba1\u6d88\u8d39',session:'\u672c\u4f1a\u8bdd\u6d88\u8d39'};

    function ModelRow({model,total}) {
      const name=(model.model??'').toLowerCase();
      const tag=/pro/.test(name)?'PRO':/flash/.test(name)?'FLASH':'MODEL';
      const share=total>0?model.cost/total:0;
      const pending=(model.unpriced??0)+(model.invalid??0);
      const cost=pending>=model.calls?DASH:money(model.cost);
      return h('details',{className:'dsc-model'},
        h('summary',{className:'dsc-model-row'},
          h('span',{className:'dsc-model-tag'},tag),
          h('span',{className:'dsc-model-name'},
            h('b',null,model.model),
            h('small',null,`${model.provider} \u00b7 ${count(model.calls)} \u6b21\u8c03\u7528`)),
          h('span',{className:'dsc-model-tokens'},
            h('b',null,compact(model.totalTokens)),
            h('small',null,'tokens')),
          h('span',{className:'dsc-model-cost'},
            h('b',null,cost),
            h('small',null,model.cost>0?pct(share):(model.invalid>0?'\u7528\u91cf\u4e0d\u5168':pending?'\u5f85\u8ba1\u4ef7':'\u2014'))),
          h('span',{className:'dsc-chev'},h(IconChevron,{size:12})),
          h('span',{className:'dsc-share','aria-hidden':'true'},h('i',{style:{width:`${Math.max(0,Math.min(100,share*100))}%`}}))),
        h('div',{className:'dsc-model-detail'},
          h('div',{className:'dsc-buckets'},[
            ['input','\u672a\u7f13\u5b58\u8f93\u5165'],
            ['cacheRead','\u7f13\u5b58\u8bfb\u53d6'],
            ['cacheWrite','\u7f13\u5b58\u5199\u5165'],
            ['output','\u8f93\u51fa'],
          ].map(([key,label])=>h('div',{className:'dsc-bucket',key},
            h('span',null,label),
            h('b',null,compact(model[key])),
            h('small',null,money(model.costs?.[key]??0)))))));
    }

    function WebRow({web,total}) {
      const share=total>0?web.cost/total:0;
      return h('details',{className:'dsc-model'},
        h('summary',{className:'dsc-model-row'},
          h('span',{className:'dsc-model-tag'},'WEB'),
          h('span',{className:'dsc-model-name'},
            h('b',null,'\u7f51\u9875\u68c0\u7d22'),
            h('small',null,`\u641c\u7d22 ${count(web.search)} \u6b21 \u00b7 \u6293\u53d6 ${count(web.fetch)} \u6b21`)),
          h('span',{className:'dsc-model-tokens'},
            h('b',null,count(web.requests)),
            h('small',null,'\u6b21')),
          h('span',{className:'dsc-model-cost'},
            h('b',null,money(web.cost)),
            h('small',null,total>0?pct(share):'\u2014')),
          h('span',{className:'dsc-chev'},h(IconChevron,{size:12})),
          h('span',{className:'dsc-share','aria-hidden':'true'},h('i',{style:{width:`${Math.max(0,Math.min(100,share*100))}%`}}))),
        h('div',{className:'dsc-model-detail'},
          h('div',{className:'dsc-buckets'},
            h('div',{className:'dsc-bucket'},h('span',null,'\u641c\u7d22'),h('b',null,count(web.search)),h('small',null,money(web.search*WEB_PRICE.search))),
            h('div',{className:'dsc-bucket'},h('span',null,'\u6293\u53d6'),h('b',null,count(web.fetch)),h('small',null,money(web.fetch*WEB_PRICE.fetch))),
            h('div',{className:'dsc-bucket'},h('span',null,'\u5408\u8ba1'),h('b',null,count(web.requests)),h('small',null,money(web.cost))),
            h('div',{className:'dsc-bucket'},h('span',null,'\u5355\u4ef7'),h('b',null,'\u00a50.005'),h('small',null,'\u6bcf\u6b21\u6210\u529f\u8bf7\u6c42')))));
    }
    //#endregion

    //#region screen
    function Dashboard({ledger,sessionId,rateForm,readAccountBalance}) {
      const state=useLedger(ledger);
      const [period,setPeriod]=React.useState('today');
      const [month,setMonth]=React.useState(()=>dateKey(Date.now()).slice(0,7));
      const [rateText,setRateText]=React.useState(null);
      const [rateMessage,setRateMessage]=React.useState('');
      const [balanceState,refreshBalance]=useBalance(readAccountBalance);

      const today=dateKey(Date.now()), currentMonth=today.slice(0,7);
      const monthSummary=ledger.summary({month:currentMonth});
      const railFact=period==='month'?['\u5168\u90e8\u7d2f\u8ba1',ledger.summary({}).cost]:['\u672c\u6708\u7d2f\u8ba1',monthSummary.cost];
      const summary=ledger.summary(period==='today'?{day:today}:period==='month'?{month}:period==='session'?{sessionId}:{});
      const balance=readBalance(balanceState);
      const loading=state.status==='loading';
      const unavailable=!state.updatedAt;
      const pending=summary.unpriced+summary.invalid;

      const chart=React.useMemo(()=>{
        const currentHour=beijing(Date.now()).getUTCHours();
        const hourly=key=>Array.from({length:24},(_,slot)=>{
          const value=ledger.summary({day:key,hour:slot});
          return {key:`${key}:${slot}`,slot,axis:pad(slot),title:`${key} ${pad(slot)}:00`,cost:value.cost,calls:value.calls,tokens:value.totalTokens,now:key===today&&slot===currentHour};
        });
        if(period==='today')return {kind:'hour',points:hourly(today),truncated:false};
        if(period==='month'){
          // A current month ends today; past months show their full calendar.
          const length=month===currentMonth?Number(today.slice(8,10)):daysInMonth(month);
          return {kind:'day',truncated:false,points:Array.from({length},(_,index)=>{
            const key=`${month}-${pad(index+1)}`, value=ledger.summary({day:key});
            return {key,axis:String(index+1),title:key,cost:value.cost,calls:value.calls,tokens:value.totalTokens,now:key===today};
          })};
        }
        if(summary.days.length===0)return {kind:'day',points:[],truncated:false};
        if(summary.days.length===1)return {kind:'hour',points:hourly(summary.days[0].day),truncated:false};
        const window=dailyWindow(summary.days.map(entry=>entry.day));
        return {kind:'day',truncated:window.truncated,points:window.days.map(key=>{
          const value=ledger.summary({day:key});
          return {key,axis:dayAxis(key),title:key,cost:value.cost,calls:value.calls,tokens:value.totalTokens,now:key===today};
        })};
      },[period,month,currentMonth,today,summary,ledger]);

      const eyebrow=period==='today'?`${RANGE_LABEL.today} \u00b7 ${dayText(today)}`
        :period==='month'?`${month===currentMonth?RANGE_LABEL.month:'\u6708\u5ea6\u6d88\u8d39'} \u00b7 ${monthText(month)}`
        :period==='session'?`${RANGE_LABEL.session} \u00b7 \u5f53\u524d\u4f1a\u8bdd`
        :`${RANGE_LABEL.all} \u00b7 \u5168\u90e8\u65f6\u95f4`;

      const rangeTabs=[['today','\u4eca\u65e5'],['month','\u6708\u5ea6'],['all','\u5168\u90e8'],...(sessionId?[['session','\u672c\u4f1a\u8bdd']]:[])];
      const ratio=state.progress&&state.progress.total?state.progress.done/state.progress.total:null;
      const statusText=state.status==='error'?(state.updatedAt?'\u66f4\u65b0\u5931\u8d25\uff0c\u663e\u793a\u4e0a\u6b21\u7edf\u8ba1':'\u66f4\u65b0\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8fde\u63a5')
        :loading?(state.progress?`\u6b63\u5728\u8bfb\u53d6\u4f1a\u8bdd ${state.progress.done} / ${state.progress.total}`:'\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u4f1a\u8bdd')
        :state.updatedAt?`\u66f4\u65b0\u4e8e ${clock(state.updatedAt)} \u00b7 \u5df2\u8bfb\u53d6 ${count(state.sessions-state.failures.length)}/${count(state.sessions)} \u4e2a\u4f1a\u8bdd`
        :'\u4ec5\u8bfb\u53d6\u4f60\u6709\u6743\u8bbf\u95ee\u7684\u4f1a\u8bdd';

      const balanceNote=balance
        ?`${balanceState.stale?'\u66f4\u65b0\u5931\u8d25\uff0c\u4e3a\u4e0a\u6b21\u7ed3\u679c \u00b7 ':''}\u5145\u503c ${balanceMoney(balance.topped,balance.currency)} \u00b7 \u8d60\u9001 ${balanceMoney(balance.granted,balance.currency)}`
        :balanceState.status==='loading'?'\u6b63\u5728\u67e5\u8be2\u4f59\u989d'
        :balanceState.body?.reason==='unconfigured'?'\u672a\u767b\u5f55 Harness \u8d26\u6237'
        :'\u4f59\u989d\u67e5\u8be2\u5931\u8d25';

      const exportData=()=>{
        const url=URL.createObjectURL(new Blob([toCSV(summary)],{type:'text/csv;charset=utf-8'}));
        const anchor=document.createElement('a');
        anchor.href=url;
        anchor.download=`deepseek-usage-${period==='month'?month:period==='today'?today:period}.csv`;
        document.body.appendChild(anchor);anchor.click();anchor.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      };

      const saveRates=async text=>{
        try{
          const rates=parseRates(text);
          const accepted=await rateForm.set('rates',JSON.stringify(rates));
          setRateMessage(accepted?'\u5355\u4ef7\u5df2\u4fdd\u5b58':'\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
          if(accepted)setRateText(null);
        }catch(error){setRateMessage(error.message);}
      };

      const alerts=[];
      if(state.status==='error')alerts.push(['error',`\u66f4\u65b0\u5931\u8d25\uff1a${state.error??'\u8bf7\u68c0\u67e5\u8fde\u63a5\u540e\u91cd\u8bd5'}`]);
      if(state.failures.length>0)alerts.push(['warn',`${count(state.failures.length)} \u4e2a\u4f1a\u8bdd\u672a\u80fd\u8bfb\u53d6\uff0c\u7edf\u8ba1\u4ec5\u542b\u5176\u4f59\u4f1a\u8bdd`]);
      const pendingParts=[];
      if(summary.unpriced>0)pendingParts.push(`${count(summary.unpriced)} \u6b21\u8c03\u7528\u7f3a\u5c11\u5355\u4ef7`);
      if(summary.invalid>0)pendingParts.push(`${count(summary.invalid)} \u6b21\u7f3a\u5c11\u5b8c\u6574\u7528\u91cf`);
      if(pendingParts.length>0)alerts.push(['muted',`${pendingParts.join('\uff0c')}\uff1b\u91d1\u989d\u4ec5\u542b\u53ef\u8ba1\u4ef7\u90e8\u5206`]);

      const hasModels=summary.models.length>0||summary.web.requests>0;
      const hasUsage=summary.calls+summary.web.requests>0;
      const ratesText=rateText??JSON.stringify(state.rates??{},null,2);

      return h('section',{className:'dsc','aria-label':'\u7528\u91cf\u8ba1\u8d39','aria-busy':loading},
        h('header',{className:'dsc-head'},
          h('div',{className:'dsc-head-main'},
            h('h1',null,'\u7528\u91cf\u8ba1\u8d39'),
            h('p',{className:`dsc-status${state.status==='error'?' is-error':''}`,'aria-live':loading?'polite':undefined},statusText)),
          h('div',{className:'dsc-actions'},
            h(IconButton,{label:loading?'\u6b63\u5728\u5237\u65b0':'\u5237\u65b0',disabled:loading,onClick:()=>{void ledger.refresh();void refreshBalance();}},
              h(IconRefresh,{className:loading?'is-spinning':''})),
            h(IconButton,{label:'\u5bfc\u51fa CSV',disabled:unavailable||loading,onClick:exportData},h(IconDownload)))),

        h('div',{className:'dsc-scope'},
          h('div',{className:'dsc-tabs',role:'group','aria-label':'\u7edf\u8ba1\u8303\u56f4'},rangeTabs.map(([id,label])=>
            h('button',{key:id,type:'button',className:'dsc-tab','aria-pressed':period===id,onClick:()=>setPeriod(id)},label))),
          period==='month'?h('label',{className:'dsc-month'},
            h('span',null,'\u6708\u4efd'),
            h('input',{type:'month',value:month,max:currentMonth,'aria-label':'\u9009\u62e9\u7edf\u8ba1\u6708\u4efd',onChange:event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))setMonth(event.target.value);}})):null),

        h('div',{className:'dsc-panel'},
          loading&&ratio!==null?h('div',{className:'dsc-progress','aria-hidden':'true'},h('i',{style:{width:`${Math.round(ratio*100)}%`}})):null,
          h('div',{className:'dsc-hero'},
            h('div',{className:'dsc-hero-main'},
              h('div',{className:'dsc-eyebrow'},eyebrow),
              h('div',{className:'dsc-value'},
                unavailable?null:h('span',{className:'dsc-cur'},'\u00a5'),
                h('b',null,unavailable?DASH:amount(summary.cost))),
              h('div',{className:'dsc-meta'},
                h('span',null,h('b',null,unavailable?DASH:count(summary.calls)),' \u6b21\u8c03\u7528'),
                h('span',null,h('b',null,unavailable?DASH:compact(summary.totalTokens)),' tokens'),
                h('span',null,'\u7f13\u5b58\u547d\u4e2d ',h('b',null,unavailable?DASH:cacheHit(summary))),
                summary.web.requests>0?h('span',null,h('b',null,count(summary.web.requests)),' \u6b21\u68c0\u7d22'):null,
                pending>0?h('span',{className:'is-warn'},h('b',null,count(pending)),' \u6b21\u672a\u8ba1\u5165'):null)),
            h('aside',{className:'dsc-rail'},
              h('div',{className:'dsc-balance'},
                h('span',null,'\u8d26\u6237\u4f59\u989d'),
                h('strong',null,balance?balanceMoney(balance.total,balance.currency):DASH),
                h('small',null,balanceNote)),
              h('div',{className:'dsc-rail-fact'},
                h('span',null,railFact[0]),
                h('b',null,unavailable?DASH:money(railFact[1]))))),
          chart.points.length>0&&hasUsage?h(Trend,{kind:chart.kind,points:chart.points,truncated:chart.truncated}):null),

        alerts.length>0?h('div',{className:'dsc-alerts'},alerts.map(([tone,text])=>
          h('p',{key:text,className:`dsc-alert is-${tone}`},text))):null,

        hasModels?h('div',null,
          h('div',{className:'dsc-section'},
            h('div',null,
              h('h2',null,'\u6a21\u578b\u660e\u7ec6'),
              h('p',null,`${count(summary.calls)} \u6b21\u8c03\u7528 \u00b7 ${compact(summary.totalTokens)} tokens${summary.web.requests>0?` \u00b7 ${count(summary.web.requests)} \u6b21\u68c0\u7d22`:''}`)),
            h('strong',null,unavailable?DASH:money(summary.cost))),
          h('div',{className:'dsc-models'},
            summary.models.map(model=>h(ModelRow,{key:`${model.provider}/${model.model}`,model,total:summary.cost})),
            summary.web.requests>0?h(WebRow,{key:'web',web:summary.web,total:summary.cost}):null))
          :h('div',{className:'dsc-empty'},h(IconEmpty),
            h('p',null,state.status==='error'?'\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u7528\u91cf':unavailable?'\u6b63\u5728\u8bfb\u53d6\u672c\u5730\u4f1a\u8bdd':'\u8fd9\u4e2a\u65f6\u6bb5\u8fd8\u6ca1\u6709\u7528\u91cf'),
            h('small',null,state.status==='error'?'\u8bf7\u68c0\u67e5\u8fde\u63a5\u540e\u5237\u65b0\u91cd\u8bd5\u3002':unavailable?'\u8bfb\u53d6\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u663e\u793a\u7edf\u8ba1\u3002':'\u5b8c\u6210\u4e00\u6b21\u6a21\u578b\u8c03\u7528\u540e\u5237\u65b0\u5373\u53ef\u67e5\u770b\u3002')),

        h('footer',{className:'dsc-foot'},
          h('div',{className:'dsc-foot-line'},
            h('span',null,`\u91d1\u989d\u4e3a\u4f30\u7b97 \u00b7 \u4ef7\u683c\u5feb\u7167 ${PRICE_VERSION}`),
            h('a',{href:PRICE_SOURCE,target:'_blank',rel:'noreferrer'},'\u5b98\u65b9\u4ef7\u683c\u8868 \u2197')),
          h('details',{className:'dsc-more'},
            h('summary',null,'\u8ba1\u4ef7\u89c4\u5219\u4e0e\u81ea\u5b9a\u4e49\u5355\u4ef7'),
            h('div',{className:'dsc-prose'},
              h('p',null,'\u6bcf\u6b21\u8c03\u7528\u6309\u5b9e\u9645 token \u7528\u91cf \u00d7 \u5b98\u65b9\u5355\u4ef7\u8ba1\u4ef7\u3002\u5317\u4eac\u65f6\u95f4\u5468\u4e00\u81f3\u5468\u4e94 09:00\u201312:00\u300114:00\u201318:00 \u4e3a\u9ad8\u5cf0\uff0c\u5176\u4f59\u65f6\u6bb5\u3001\u5468\u672b\u4e0e\u6cd5\u5b9a\u8282\u5047\u65e5\u6309\u9ad8\u5cf0\u4ef7\u7684\u4e00\u534a\u8ba1\u4ef7\u3002\u5206\u53c9\u7ee7\u627f\u7684\u5386\u53f2\u4e0d\u91cd\u590d\u8ba1\u8d39\uff0c\u91cd\u8bd5\u5355\u72ec\u8ba1\u6b21\u3002'),
              h('p',null,'\u4ec5\u7edf\u8ba1\u4f1a\u8bdd\u65e5\u5fd7\u4e2d\u7684\u6a21\u578b token \u7528\u91cf\uff0c\u4ee5\u53ca\u6210\u529f\u7ed3\u7b97\u7684\u7f51\u9875\u641c\u7d22\u4e0e\u6293\u53d6\uff085 \u5143 / 1000 \u6b21\uff0c\u6bcf\u6b21 \u00a50.005\uff09\u3002\u91d1\u989d\u4e3a\u4f30\u7b97\uff0c\u4ee5\u5b98\u65b9\u8d26\u5355\u4e3a\u51c6\u3002')),
            rateForm?h('div',{className:'dsc-rates'},
              h('div',{className:'dsc-rates-head'},h('h3',null,'\u81ea\u5b9a\u4e49\u6a21\u578b\u5355\u4ef7'),h('span',null,'\u5143 / \u767e\u4e07 tokens')),
              h('p',null,'\u4e3a\u672a\u8bc6\u522b\u7684\u6a21\u578b\u586b\u5199 provider/model \u56db\u9879\u5355\u4ef7\u3002\u81ea\u5b9a\u4e49\u5355\u4ef7\u4e0d\u4eab\u53d7\u5cf0\u8c37\u6298\u6263\uff0c\u4fdd\u5b58\u540e\u5bf9\u5168\u90e8\u5386\u53f2\u91cd\u65b0\u8ba1\u4ef7\u3002'),
              h('textarea',{'aria-label':'\u6a21\u578b\u4ef7\u683c JSON',spellCheck:false,value:ratesText,placeholder:'{"provider/model":{"input":1,"cacheRead":0.1,"cacheWrite":1,"output":2}}',onChange:event=>setRateText(event.target.value)}),
              h('div',{className:'dsc-rate-actions'},
                h('button',{type:'button',className:'dsc-btn dsc-btn--primary',onClick:()=>void saveRates(ratesText)},'\u4fdd\u5b58\u5355\u4ef7'),
                h('button',{type:'button',className:'dsc-btn',onClick:()=>void saveRates('{}')},'\u6062\u590d\u5185\u7f6e\u4ef7\u683c'),
                h('span',{className:'dsc-rate-msg',role:'status'},rateMessage))):null)));
    }
    //#endregion

    //#region composer popover
    function CostBubble({ledger,sessionId,readAccountBalance}) {
      const state=useLedger(ledger,15000);
      const [balanceState,refreshBalance]=useBalance(readAccountBalance);
      const summary=ledger.summary({sessionId});
      const today=ledger.summary({day:dateKey(Date.now())});
      const balance=readBalance(balanceState);
      const balanceText=balance?balanceMoney(balance.total,balance.currency)
        :balanceState.status==='loading'?'\u2026'
        :balanceState.body?.reason==='unconfigured'?'\u672a\u767b\u5f55'
        :balanceState.status==='error'?'\u67e5\u8be2\u5931\u8d25'
        :DASH;
      const ready=state.updatedAt;
      const loading=state.status==='loading';
      const pending=summary.unpriced+summary.invalid;
      const notes=[];
      if(state.status==='error')notes.push(ready?'\u66f4\u65b0\u5931\u8d25\uff0c\u663e\u793a\u4e0a\u6b21\u7ed3\u679c':'\u66f4\u65b0\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8fde\u63a5');
      if(pending>0)notes.push(`${count(pending)} \u6b21\u8c03\u7528\u672a\u8ba1\u5165`);
      // Cache writes only exist for providers/models that report them; a zero
      // row for everyone else is noise. Show it when this session produced some.
      const buckets=[
        ['input','\u672a\u7f13\u5b58\u8f93\u5165'],
        ['cacheRead','\u7f13\u5b58\u8bfb\u53d6'],
        ['cacheWrite','\u7f13\u5b58\u5199\u5165'],
        ['output','\u8f93\u51fa'],
      ].filter(([key])=>key!=='cacheWrite'||summary.cacheWrite>0);
      return h('div',{className:'dsc-pop-body'},
        h('div',{className:'dsc-pop-head'},
          h('span',{className:'dsc-pop-title'},h(IconCost,{size:14}),'\u672c\u4f1a\u8bdd\u6d88\u8d39'),
          h('b',{className:'dsc-pop-cost'},ready?money(summary.cost):DASH)),
        h('div',{className:'dsc-pop-sub'},
          h('span',null,`\u4eca\u65e5 ${ready?money(today.cost):DASH}`),
          h('i',null,'\u00b7'),
          h('span',{title:balanceState.stale?'\u4f59\u989d\u5237\u65b0\u5931\u8d25\uff0c\u663e\u793a\u4e0a\u6b21\u7ed3\u679c':undefined},`\u4f59\u989d ${balanceText}`)),
        h('div',{className:'dsc-pop-rule','aria-hidden':'true'}),
        h('div',{className:'dsc-pop-rows'},buckets.map(([key,label])=>
          h('div',{className:'dsc-pop-row',key},
            h('span',null,label),
            h('b',null,ready?`${count(summary[key])} tok`:DASH),
            h('small',null,ready?money(summary.costs[key]):DASH)))),
        summary.web.requests>0?h('div',{className:'dsc-pop-row'},
          h('span',null,'\u7f51\u9875\u68c0\u7d22'),
          h('b',null,`${count(summary.web.requests)} \u6b21`),
          h('small',null,money(summary.web.cost))):null,
        notes.length>0?h('p',{className:'dsc-pop-note'},notes.join('\uff1b')):null,
        h('div',{className:'dsc-pop-rule','aria-hidden':'true'}),
        h('div',{className:'dsc-pop-foot'},
          h('span',null,ready?h(React.Fragment,null,
            h('b',null,count(summary.calls)),' \u6b21\u8c03\u7528',
            h('i',null,'\u00b7'),
            `\u7f13\u5b58\u547d\u4e2d ${cacheHit(summary)}`,
            h('i',null,'\u00b7'),
            clock(state.updatedAt)):(loading?'\u6b63\u5728\u8bfb\u53d6\u7528\u91cf\u2026':'\u5c1a\u672a\u8bfb\u53d6\u7528\u91cf')),
          h('button',{type:'button',className:'dsc-pop-refresh',title:'\u5237\u65b0','aria-label':'\u5237\u65b0\u7528\u91cf',disabled:loading,onClick:()=>{void ledger.refresh();void refreshBalance();}},
            h(IconRefresh,{className:loading?'is-spinning':''}))));
    }

    function CostDock({ledger,sessionId,useProjection,readAccountBalance}) {
      const state=React.useSyncExternalStore(ledger.subscribe,ledger.getSnapshot,ledger.getSnapshot);
      const [open,setOpen]=React.useState(false);
      const [popId]=React.useState(()=>`session-cost-popover-${++popoverSeq}`);
      const trigger=React.useRef(null);
      const usage=useProjection('tokenUsage');
      const active=usage&&Object.values(usage).some(value=>typeof value==='number'&&value>0);
      const signature=JSON.stringify(usage??null);
      React.useEffect(()=>{if(active)ledger.refreshSoon();},[ledger,signature,active]);
      const close=React.useCallback(()=>setOpen(false),[]);

      const today=ledger.summary({day:dateKey(Date.now())});
      const session=ledger.summary({sessionId});
      const ready=state.updatedAt;
      const title=ready?`\u672c\u4f1a\u8bdd ${money(session.cost)}\uff1b\u4eca\u65e5 ${money(today.cost)}`:'\u7528\u91cf\u8ba1\u8d39';

      return h(React.Fragment,null,
        h('span',{className:'dsc-anchor'},
          h('button',{ref:trigger,type:'button',className:'dsc-pill','aria-haspopup':'dialog','aria-expanded':open,'aria-controls':popId,title,onClick:()=>setOpen(value=>!value)},
            h(IconCost,{size:13}),
            h('b',null,ready?money(session.cost):'\u7528\u91cf'),
            ready?h('i',null,'\u00b7'):null,
            ready?h('span',{className:'dsc-pill-sub'},`\u4eca\u65e5 ${money(today.cost)}`):null)),
        open?h(Popover,{id:popId,anchorRef:trigger,label:'\u672c\u4f1a\u8bdd\u6d88\u8d39',onClose:close},
          h(CostBubble,{ledger,sessionId,readAccountBalance})):null);
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
      ctx.effect(()=>ctx.locale.register(NS,{zh:{title:'\u7528\u91cf\u8ba1\u8d39'},en:{title:'Usage & billing'}}));
      ctx.effect(()=>{const style=document.createElement('style');style.dataset.plugin='@local/session-cost';style.textContent=CSS;document.head.appendChild(style);return()=>style.remove();});
      ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'session-cost',order:6,locale:NS,label:()=>ctx.locale.bind(NS)('title'),inject:()=>({ledger,rateForm,readAccountBalance})},Dashboard));
      ctx.slots.inject('settings.section.icon',()=>ctx.slots.register({name:'settings.section.icon',id:'session-cost'},IconCost));
      ctx.slots.inject('conversation.composer.dock',()=>ctx.slots.register({name:'conversation.composer.dock',id:'cost',order:2,locale:NS,inject:sessionId=>({ledger,sessionId,readAccountBalance})},CostDock));
    }};
  },
});
