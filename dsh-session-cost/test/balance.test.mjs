import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBalance} from '../src/balance.mjs';
test('account wallets keep currencies separate and include bonuses',()=>{
  const result=normalizeBalance({ok:true,value:{status:'ready',value:[{currency:'CNY',balance:'12.50'},{currency:'USD',balance:'3'}],bonusWallets:[{currency:'CNY',balance:'2.5'}]}});
  assert.equal(result.infos.find(i=>i.currency==='CNY').totalBalance,'15');
  assert.equal(result.infos.find(i=>i.currency==='USD').totalBalance,'3');
});
test('signed out, rejected and malformed balances are not displayed as zero',()=>{
  assert.equal(normalizeBalance({ok:true,value:null}).reason,'unconfigured');
  assert.equal(normalizeBalance({ok:false}).ok,false);
  assert.equal(normalizeBalance({ok:true,value:{status:'ready',value:[{currency:'CNY',balance:'invalid'}],bonusWallets:[]}}).ok,false);
});
