import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState, gameReducer, migrateSave, housing, shelterLevel, shelterCondition, shelterWork, weatherReadiness, removalInfo } from './engine.js'
import { WEATHER, SHELTER_LEVELS, ISLANDS } from './data.js'
import { Player } from './player.js'

const home = (id, level=1, condition=100, slot=0) => ({ id, type:'shelter', island:'newHaven', slot, shelterLevel:level, condition })
const job = (state, n) => gameReducer({ ...state, backpack:{}, resources:{...state.resources, food:80,water:80} },{type:'GATHER_WOOD',now:n*1e9})
const withHomes = () => { const s=createInitialState(); return {...s,xp:750,buildings:[...s.buildings,home('house')],resources:{...s.resources,wood:100,stone:100,materials:10}} }

test('events give a 24-job grace period, six warning jobs, five active jobs and 12–20 recovery jobs', () => {
  let s=createInitialState(), n=0
  for(let i=0;i<23;i++){s=job(s,++n);assert.equal(s.weather,'clear');assert.equal(s.weatherCycle.phase,'calm')}
  s=job(s,++n);assert.equal(s.weatherCycle.phase,'warning');assert.equal(s.weatherCycle.remaining,6)
  const forecast=s.forecast
  for(let i=0;i<5;i++){s=job(s,++n);assert.equal(s.weather,'clear');assert.equal(s.forecast,forecast)}
  s=job(s,++n);assert.equal(s.weather,forecast);assert.equal(s.weatherCycle.remaining,5)
  for(let i=0;i<4;i++){s=job(s,++n);assert.equal(s.weather,forecast)}
  s=job(s,++n);assert.equal(s.weather,'clear');assert.equal(s.weatherCycle.events,1)
  const recovery=s.weatherCycle.remaining
  assert.ok(recovery>=12&&recovery<=20)
  for(let i=1;i<recovery;i++){s=job(s,++n);assert.equal(s.weatherCycle.phase,'calm')}
  s=job(s,++n);assert.equal(s.weatherCycle.phase,'warning');assert.notEqual(s.forecast,forecast)
})

test('saved random streams vary by town, survive reloads and never schedule back-to-back events', () => {
  const forecasts=new Set()
  for(const seed of [1,519,91831,4294967290,708234]){
    let s={...createInitialState(seed),xp:1000,connected:['newHaven','prism']}, lastEnd=null, lastWeather=null, activeStart=null
    for(let n=1;n<250;n++){
      const before=s
      s=job(s,n)
      const restored=job(migrateSave(JSON.parse(JSON.stringify(before))),n)
      assert.deepEqual(restored.weatherCycle,s.weatherCycle)
      assert.equal(restored.weather,s.weather);assert.equal(restored.forecast,s.forecast)
      if(before.weatherCycle.phase==='calm'&&s.weatherCycle.phase==='warning'){
        forecasts.add(s.forecast)
        if(lastEnd!==null) assert.ok(n-lastEnd>=12)
        if(s.weatherCycle.events<2)assert.notEqual(s.forecast,'solarStorm')
        assert.notEqual(s.forecast,lastWeather)
      }
      if(before.weatherCycle.phase==='warning'&&s.weatherCycle.phase==='active')activeStart=n
      if(before.weatherCycle.phase==='active'&&s.weatherCycle.phase==='calm'){
        assert.equal(n-activeStart,5);lastEnd=n;lastWeather=before.weather
      }
    }
  }
  assert.ok(forecasts.size>=4)
})

test('walking, menus, deposits, removals and failed jobs never consume a warning or reroll weather', () => {
  let s=withHomes();s={...s,forecast:'heavyRain',weatherCycle:{...s.weatherCycle,phase:'warning',remaining:4}}
  for(const action of [{type:'PLAYER_POSITION',position:{island:'newHaven',x:635,y:610}},{type:'READ_JOURNAL'},{type:'DEPOSIT_BACKPACK'},{type:'BUILD',buildingType:'battery',island:'newHaven',slot:1},{type:'UPGRADE_SHELTER',buildingId:'missing'},{type:'REPAIR_SHELTER',buildingId:'house'}]){
    assert.deepEqual(gameReducer(s,action).weatherCycle,s.weatherCycle)
  }
  const removed=gameReducer(s,{type:'REMOVE_BUILDING',buildingId:'house'})
  assert.deepEqual(removed.weatherCycle,s.weatherCycle)
})

test('weather damages only underprepared shelters and disabled housing is recoverable', () => {
  for(const key of Object.keys(WEATHER).filter(k=>k!=='clear')){
    let s=withHomes();const required=WEATHER[key].shelterLevel
    s={...s,weather:key,forecast:key,weatherCycle:{...s.weatherCycle,phase:'active',remaining:5},buildings:[...s.buildings,home('ready',required,100,1)]}
    assert.equal(weatherReadiness(s).vulnerable,1)
    const before=housing(s)
    for(let n=1;n<=5;n++)s=job(s,n)
    assert.equal(shelterCondition(s.buildings.find(b=>b.id==='house')),0,key)
    assert.equal(shelterCondition(s.buildings.find(b=>b.id==='ready')),100,key)
    assert.equal(housing(s),before-4,key)
    const fixed=gameReducer(s,{type:'REPAIR_SHELTER',buildingId:'house'})
    assert.equal(shelterCondition(fixed.buildings.find(b=>b.id==='house')),100)
    assert.equal(housing(fixed),before)
    assert.equal(shelterLevel(fixed.buildings.find(b=>b.id==='house')),1)
  }
})

test('last-warning upgrades protect immediately, track actual upgrade materials and exclude repairs from refunds', () => {
  let s=withHomes();s={...s,forecast:'heavyRain',weatherCycle:{...s.weatherCycle,phase:'warning',remaining:1}}
  s=gameReducer(s,{type:'UPGRADE_SHELTER',buildingId:'house'})
  assert.equal(s.weather,'heavyRain');assert.equal(shelterLevel(s.buildings.at(-1)),2)
  s=job(s,1);assert.equal(shelterCondition(s.buildings.at(-1)),100)
  s={...s,weather:'clear',forecast:'clear',weatherCycle:{...s.weatherCycle,phase:'calm',remaining:20}}
  s=gameReducer(s,{type:'UPGRADE_SHELTER',buildingId:'house'})
  assert.equal(shelterLevel(s.buildings.at(-1)),3)
  assert.deepEqual(s.buildings.at(-1).paidCost,{wood:26,stone:11,materials:2})
  const noUpgrade=gameReducer(s,{type:'UPGRADE_SHELTER',buildingId:'house'})
  assert.deepEqual(noUpgrade.resources,s.resources);assert.deepEqual(noUpgrade.weatherCycle,s.weatherCycle)
  s={...s,buildings:s.buildings.map(b=>b.id==='house'?{...b,condition:20}:b)}
  s=gameReducer(s,{type:'REPAIR_SHELTER',buildingId:'house'})
  assert.deepEqual(removalInfo(s,{buildingId:'house'}).refund,{wood:13,stone:5,materials:1})
  const locked={...withHomes(),xp:0,buildings:[home('house',2)]}
  assert.match(shelterWork(locked,'house').reason,/level 3/)
  const cutOff={...withHomes(),buildings:[{...home('house'),island:'verdant'}]}
  assert.match(shelterWork(cutOff,'house').reason,/Reconnect/)
})

test('the captain must finish shelter work before supplies are spent, and can cancel it', () => {
  let s=withHomes(),calls=0
  const plot=ISLANDS.newHaven.plots[0]
  s={...s,player:{island:'newHaven',x:plot[0]+40,y:plot[1]+20}}
  const p=new Player(s)
  const dispatch=action=>{calls++;s=gameReducer(s,action);p.sync(s)}
  assert.ok(p.request({type:'UPGRADE_SHELTER',buildingId:'house'},dispatch))
  for(let i=0;i<1000&&!p.avatar.task;i++)p.update(.05)
  assert.equal(p.avatar.task.kind,'repair');assert.equal(calls,0)
  p.cancel();for(let i=0;i<50;i++)p.update(.1)
  assert.equal(calls,0);assert.equal(s.resources.wood,100)
  assert.ok(p.request({type:'UPGRADE_SHELTER',buildingId:'house'},dispatch))
  for(let i=0;i<1000&&p.pending;i++)p.update(.05)
  assert.equal(calls,1);assert.equal(s.resources.wood,94);assert.equal(shelterLevel(s.buildings.at(-1)),2)
})

test('old towns get a full grace period and existing shelters; corrupt saves cannot skip preparation', () => {
  const old={...withHomes(),version:6,weather:'solarStorm',forecast:'heavyRain'};delete old.weatherCycle
  const loaded=migrateSave(old)
  assert.equal(loaded.version,7);assert.equal(loaded.weather,'clear');assert.equal(loaded.weatherCycle.remaining,24)
  assert.equal(shelterCondition(loaded.buildings.at(-1)),100)
  assert.equal(shelterLevel(loaded.buildings.at(-1)),1)
  const bad=migrateSave({...loaded,forecast:'unknown',weatherCycle:{phase:'warning',remaining:NaN}})
  assert.equal(bad.weatherCycle.phase,'calm');assert.equal(bad.weatherCycle.remaining,24)
  for(const level of [2,3])assert.ok(Object.keys(SHELTER_LEVELS[level].cost).length)
})
