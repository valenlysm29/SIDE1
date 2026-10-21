"""Propuesta gráfica: prueba aislada con fuentes locales y sin escrituras remotas."""
from pathlib import Path
import base64
import json
import sys
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
import browser_fixture

OUT = ROOT / 'tests/output/faculty-theme'
OUT.mkdir(parents=True, exist_ok=True)
checks = []

def ok(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)

document = browser_fixture.document('docente.html')
for font in (ROOT / 'assets/fonts/poppins').glob('*.ttf'):
    uri = 'data:font/ttf;base64,' + base64.b64encode(font.read_bytes()).decode()
    document = document.replace('../assets/fonts/poppins/' + font.name, uri)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.route('**/*', lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(document, wait_until='load')
    page.evaluate('document.fonts.ready')
    page.wait_for_function("document.getElementById('configCycleCount').textContent.includes('/')")
    ok('Poppins local cargada', page.evaluate("document.fonts.check('500 14px Poppins') && getComputedStyle(document.body).fontFamily.includes('Poppins')"))
    ok('Colores del PDF', page.evaluate("getComputedStyle(document.body).backgroundColor==='rgb(8, 26, 52)' && getComputedStyle(document.querySelector('.card')).backgroundColor==='rgb(9, 24, 47)' && getComputedStyle(document.querySelector('.card-title h3')).color==='rgb(57, 208, 255)'"))
    ok('Títulos de cajas en mayúsculas', page.evaluate("getComputedStyle(document.querySelector('.card-title h3')).textTransform==='uppercase'"))
    page.locator('#capitalModeRandom').check()
    expect(page.locator('#randomCapitalFields')).to_be_visible()
    ok('Selección celeste', page.evaluate("getComputedStyle(document.querySelector('#capitalModeRandom').parentElement).borderTopColor==='rgb(57, 208, 255)'"))
    page.locator('#capitalModeFixed').check()
    page.locator('#openEventPicker').click()
    expect(page.locator('#eventPicker')).to_be_visible()
    page.locator('input[name=eventSelectionMode][value=random]').check()
    page.locator('#eventRandomize').click()
    ok('Selector de eventos operativo', page.locator('.event-enable:checked').count() == 15)
    page.locator('#closeEventPicker').click()
    for width, height in [(1440,1000), (1150,800), (768,1024), (360,800), (320,740)]:
        page.set_viewport_size({'width':width,'height':height})
        for tab in ['configuracion','empresas','resultados','podio','historial']:
            page.locator(f'.nav-btn[data-tab="{tab}"]').click()
            expect(page.locator('#tab-' + tab)).to_be_visible()
            ok(f'{tab} sin desborde {width}', page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.locator('.nav-btn[data-tab="configuracion"]').click()
        page.mouse.move(0, 0)
        page.evaluate("document.getElementById('toast').classList.remove('show')")
        ok(f'Regreso al inicio visible {width}', page.locator('#backHome').is_visible())
        if width <= 820:
            # La sección de rondas aparece cuando hay una partida activa.
            page.locator('.nav-btn[data-tab="rondas"]').evaluate("el=>el.classList.remove('hidden')")
            ok(f'Todas las secciones visibles sin deslizar {width}', page.locator('.sidebar nav').evaluate("el=>[...el.children].every(b=>{const r=b.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.height>=44}) && el.scrollWidth<=el.clientWidth"))
            ok(f'Cabecera de navegación compacta {width}', page.locator('.sidebar').bounding_box()['height'] < 190)
            page.locator('.nav-btn[data-tab="rondas"]').evaluate("el=>el.classList.add('hidden')")
            ok(f'Acciones de copiar en la misma fila {width}', abs(page.locator('#copyGameCode').bounding_box()['y'] - page.locator('#copyGameLink').bounding_box()['y']) < 1)
        page.screenshot(path=str(OUT / f'configuracion-{width}.png'), full_page=True)
        if width in (1440, 360):
            page.screenshot(path=str(OUT / f'vista-{width}.png'))
    page.locator('#saveAll').focus()
    page.keyboard.press('Tab')
    page.keyboard.press('Shift+Tab')
    ok('Foco de teclado visible', page.locator('#saveAll').evaluate("el => getComputedStyle(el).outlineStyle === 'solid'"))
    page.emulate_media(reduced_motion='reduce')
    ok('Movimiento reducido respetado', page.locator('.tab-panel.active').evaluate("el=>getComputedStyle(el).animationName==='none'"))
    ok('Sin errores JavaScript', not errors)
    browser.close()

(OUT / 'checks.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
