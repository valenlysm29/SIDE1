'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'character-selection.css'),'utf8');
const script=fs.readFileSync(path.join(root,'services/character_selection.js'),'utf8');
const section=html.match(/<section id="characterSelection"[\s\S]*?<\/section>/)?.[0];

test('selector supports selection, persistence, confirmation, keyboard and target desktop sizes',async()=>{
  assert.ok(section,'character selector markup exists');
    const windowsChrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
    const executablePath=process.env.CHROMIUM_PATH||(fs.existsSync(windowsChrome)?windowsChrome:undefined);
    const browser=await chromium.launch(executablePath?{executablePath,headless:true}:{headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.setContent(`<!doctype html><html><head><style>.hidden{display:none!important}${css}</style></head><body>${section}</body></html>`);
    await page.evaluate(()=>{
      const values=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),
        key:index=>[...values.keys()][index]??null,get length(){return values.size;}
      }});
    });
    await page.addScriptTag({content:script});
    assert.equal(await page.evaluate(()=>CharacterSelection.getSelected()),null);
    assert.equal(await page.locator('#confirmCharacterBtn').isDisabled(),true);

    await page.evaluate(()=>CharacterSelection.open());
    await page.locator('[data-character="joel"]').click();
    assert.equal(await page.locator('[data-character="joel"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-character="joel"] small').textContent(),'SELECCIONADO');
    assert.equal(await page.locator('#confirmCharacterBtn').isEnabled(),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('SIDE_SELECTED_CHARACTER')),'joel');

    const confirmation=page.evaluate(()=>new Promise(resolve=>document.getElementById('characterSelection').addEventListener('side:character-confirmed',event=>resolve(event.detail.character),{once:true})));
    await page.locator('#confirmCharacterBtn').click();
    assert.equal(await confirmation,'joel');

    await page.locator('[data-character="joel"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.character),'gonzalo');

    for(const viewport of [{width:1920,height:1080},{width:1600,height:900},{width:1366,height:768},{width:1280,height:720}]){
      await page.setViewportSize(viewport);
      const layout=await page.evaluate(()=>({
        body:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},
        viewport:{w:innerWidth,h:innerHeight},
        cards:[...document.querySelectorAll('.character-card')].map(card=>{const box=card.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom};})
      }));
      assert.ok(layout.body.w<=layout.viewport.w,'selector does not overflow horizontally');
      assert.equal(layout.cards.length,4);
      assert.ok(layout.cards.every(card=>card.left>=0&&card.right<=layout.viewport.w&&card.top>=0&&card.bottom<=layout.body.h));
    }
  }finally{await browser.close();}
});
