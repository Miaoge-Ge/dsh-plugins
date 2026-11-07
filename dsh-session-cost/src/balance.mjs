// Use the authenticated account Remote shared by Desktop and Web. Never expose
// a separate HTTP route or read API credentials inside this plugin.
export function normalizeBalance(result) {
  if (!result?.ok) return {ok:false,reason:'network'};
  const balance=result.value;
  if (balance===null) return {ok:false,reason:'unconfigured'};
  if (balance?.status!=='ready') return {ok:false,reason:'network'};
  const wallets=balance.value??[], bonuses=balance.bonusWallets??[];
  const currencies=[...new Set([...wallets,...bonuses].map(w=>w.currency))];
  const infos=[];
  for (const currency of currencies) {
    if (!['CNY','USD'].includes(currency)) continue;
    const sum=list=>list.filter(w=>w.currency===currency).reduce((n,w)=>{
      if (typeof w.balance!=='string' || !/^-?\d+(\.\d+)?$/.test(w.balance)) return NaN;
      return n+Number(w.balance);
    },0);
    const topped=sum(wallets),granted=sum(bonuses);
    if (![topped,granted,topped+granted].every(Number.isFinite)) return {ok:false,reason:'payload'};
    infos.push({currency,totalBalance:String(topped+granted),grantedBalance:String(granted),toppedUpBalance:String(topped)});
  }
  return infos.length?{ok:true,available:true,infos}:{ok:false,reason:'payload'};
}
