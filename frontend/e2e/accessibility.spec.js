import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

async function start(page, checkpoint='new-town') {
  const state=JSON.parse(readFileSync(new URL(`./checkpoints/${checkpoint}.json`,import.meta.url),'utf8'))
  await page.addInitScript(state=>{localStorage.setItem('cloudbreakers-guest','1');localStorage.setItem('cloudbreakers-save-v1',JSON.stringify(state))},state)
  await page.goto('/')
  await expect(page.getByRole('button',{name:'Game actions',exact:true})).toBeVisible()
}
async function tabTo(page, locator) {
  for(let i=0;i<80;i++){
    if(await locator.evaluate(el=>el===document.activeElement))return
    await page.keyboard.press('Tab')
  }
  throw new Error('Control could not be reached with Tab')
}

test('skip link, modal focus containment, Escape and focus restoration work with a keyboard',async({page})=>{
  await start(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link',{name:'Skip map to game actions'})).toBeFocused()
  await page.keyboard.press('Enter')
  const open=page.getByRole('button',{name:'Game actions',exact:true})
  await expect(open).toBeFocused();await page.keyboard.press('Enter')
  const dialog=page.getByRole('dialog',{name:'Game actions',exact:true})
  await expect(dialog).toHaveAttribute('aria-modal','true')
  await expect(dialog.getByRole('heading',{name:'Game actions',exact:true})).toBeFocused()
  expect(await page.locator('.camera').evaluate(el=>Boolean(el.closest('[inert]')))).toBe(true)
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button',{name:'Town Storage and resource amounts'})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0);await expect(open).toBeFocused()
  expect(await page.locator('.camera').evaluate(el=>Boolean(el.closest('[inert]')))).toBe(false)
})

test('a player can build and hear the result without selecting a plot on the visual map',async({page})=>{
  await start(page)
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.keyboard.press('Enter')
  await tabTo(page,page.getByRole('button',{name:'Build on New Haven',exact:true}));await page.keyboard.press('Enter')
  const workshop=page.getByRole('dialog',{name:'Town Workshop'})
  const shelter=workshop.getByRole('button',{name:'Build Shelter',exact:true})
  await tabTo(page,shelter);await page.keyboard.press('Enter')
  const location=page.getByLabel('Build location', {exact:true})
  await expect(location).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(location).toHaveValue('newHaven:1')
  await page.keyboard.press('Home')
  await expect(location).toHaveValue('newHaven:0')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Build here',exact:true})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cloudbreakers-save-v1')).buildings.some(b=>b.type==='shelter')),{timeout:20000}).toBe(true)
  await expect(page.getByRole('log')).toContainText('Shelter built')
})

test('nested bridge dialogs close without closing the island drawer and restore the trigger',async({page})=>{
  await start(page,'anchor-ready')
  await page.getByRole('button',{name:'Game actions',exact:true}).click()
  await page.getByLabel('Island',{exact:true}).selectOption('verdant')
  await page.getByRole('dialog',{name:'Game actions',exact:true}).getByRole('button',{name:'Explore Verdant Reach',exact:true}).click()
  const drawer=page.getByRole('dialog',{name:'Verdant Reach',exact:true}),plan=drawer.getByRole('button',{name:'Plan a bridge',exact:true})
  await plan.click()
  const bridge=page.getByRole('dialog',{name:'Bridge to Verdant Reach',exact:true})
  await expect(bridge).toHaveAttribute('aria-modal','true')
  await page.keyboard.press('Escape')
  await expect(bridge).toHaveCount(0);await expect(drawer).toBeVisible();await expect(plan).toBeFocused()
})

test('resource controls have keyboard activation and navigation keys do not move the captain',async({page})=>{
  await start(page)
  const captain=page.getByRole('button',{name:'Center me',exact:true}),before=await captain.getAttribute('data-player-x')
  await page.getByRole('button',{name:'Game actions',exact:true}).focus()
  await page.keyboard.press('ArrowRight');await page.keyboard.press('d');await page.waitForTimeout(250)
  await expect(captain).toHaveAttribute('data-player-x',before)
  const resources=page.getByRole('button',{name:'Resources — open storage',exact:true})
  await resources.focus();await page.keyboard.press('Space')
  await expect(page.getByRole('dialog',{name:'Storehouse',exact:true})).toBeVisible()
  await page.keyboard.press('Escape');await expect(resources).toBeFocused()
})

test('reduced motion uses an immediate camera movement, and game actions fit on a phone',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.setViewportSize({width:390,height:664})
  await start(page);await page.waitForTimeout(200)
  await page.getByRole('button',{name:'Center me',exact:true}).click()
  const transform=await page.locator('.cam-world').evaluate(el=>el.style.transform)
  await page.waitForTimeout(150)
  expect(await page.locator('.cam-world').evaluate(el=>el.style.transform)).toBe(transform)
  await page.getByRole('button',{name:'Game actions',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Game actions',exact:true})
  await expect(dialog.getByLabel('Island',{exact:true})).toBeInViewport()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
