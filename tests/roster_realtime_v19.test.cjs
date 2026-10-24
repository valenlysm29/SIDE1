'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
test('one roster channel, slow reconciliation while connected, backoff and cleanup',()=>{
 let time=1000,loads=0;const channels=[],intervals=[],timers=new Map();let next=0;
 const client={channel:()=>{const channel={on(){return this;},subscribe(callback){this.status=callback;return this;}};channels.push(channel);return channel;},removeChannel:channel=>channel.status('CLOSED')};
 const context={window:{SIDE:{SupabaseClient:{get:()=>client}}},state:{partidaId:'A'},document:{hidden:false},gradeQueue:null,rosterSyncError:'',Date:{now:()=>time},
  setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},clearTimeout:id=>timers.delete(id),
  loadReports:()=>loads++,renderCompanies(){},renderTeacherLobby(){},presenceTracker:{observe(){}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let companiesPoll='),source.indexOf('\nfunction generateGameCode(')),context);
 context.startLiveCompanies();context.startLiveCompanies();assert.equal(channels.length,1);
 channels[0].status('SUBSCRIBED');for(const [id,timer] of timers){timers.delete(id);timer.fn();}const initial=loads;
 intervals[0]();assert.equal(loads,initial);time=31000;intervals[0]();assert.equal(loads,initial+1);
 channels[0].status('CHANNEL_ERROR');assert.ok([...timers.values()].some(t=>t.delay===3000));
 const retry=[...timers.entries()].find(([,t])=>t.delay===3000);timers.delete(retry[0]);retry[1].fn();assert.equal(channels.length,2);
 channels[0].status('CLOSED');assert.equal(timers.size,0,'obsolete channel cannot schedule retries');
 context.stopLiveCompanies();assert.equal(timers.size,0,'leaving the room clears all retries');
});
