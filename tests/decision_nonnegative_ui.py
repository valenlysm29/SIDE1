"""Decisiones numéricas: UI real con almacenamiento aislado y red bloqueada."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
from browser_fixture import load

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/decision-nonnegative'
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(label,condition=True):
    assert condition,label
    checks.append(label);print('PASS',label,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    context=browser.new_context(viewport={'width':1366,'height':900})
    context.route('**/*',lambda route:route.abort())
    page=context.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    load(page,'index.html',{'SIDE_TEACHER_CONFIG':json.dumps({'capital':100000,'cycles':6,'roundMinutes':10})})
    page.evaluate("""()=>{
      currentStudent={company:'Numeros QA',legalName:'Numeros QA',game:DEMO_GAME};
      localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));
      localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,running:true,startedAt:new Date().toISOString(),duration:600,remaining:600}));
      currentCategory='B';openDecisionMenu();
    }""")
    def category(cat):
        page.evaluate("cat=>{currentCategory=cat;renderTabs();renderDecisionCategory()}",cat)
    def negative(selector):
        field=page.locator(selector).first
        field.fill('-25')
        expect(field).to_have_value('0')
        field.fill('12')
        field.press('End');field.press('-')
        expect(field).to_have_value('12')
        field.evaluate("el=>{const data=new DataTransfer();data.setData('text','-45');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));}")
        expect(field).to_have_value('0')
    negative('[data-qty="MESA_CORTE"]')
    ok('Compras bloquean negativos por entrada, tecla y pegado')
    category('C');negative('[data-mold-target]')
    ok('Producción bloquea negativos por entrada, tecla y pegado')
    fields=page.locator('[data-qty]')
    if fields.count():
        fields.first.fill('-5');expect(fields.first).to_have_value('0')
        ok('Personal no muestra cantidades negativas')
    category('E');negative('[data-loan-number]')
    page.locator('[data-loan-number]').fill('123.45')
    ok('Préstamos conservan decimales positivos',page.evaluate("initDraft(findDecisionItem('PRESTAMO')).amount===123.45"))
    category('F');negative('[data-qty]')
    page.locator('#saveDecisionSection').click()
    ok('Materiales guardados sin cantidades negativas',page.evaluate("allDecisionItems().filter(i=>i.material).every(i=>Object.values(decisionState[i.id]?.quantities||{}).every(n=>n>=0))"))
    ok('Bajar cantidad de activos con equipos previos se detiene en cero',page.evaluate("""()=>{
      const item=findDecisionItem('MESA_CORTE'),option=item.options[0].id;
      localStorage.setItem('SIDE_ACTIVE_ROUND','2');decisionState.MESA_CORTE={round:1,purchases:{1:{[option]:2}}};
      decisionDrafts={};currentCategory='B';changeQty('MESA_CORTE',option,-10);
      return getOwned(item,option)===2&&Object.values(initDraft(item).quantities).every(n=>n>=0)&&[...document.querySelectorAll('#decisionMenu input[type=number]')].every(el=>Number(el.min)>=0);
    }"""))
    # Restored drafts are sanitized before calculating and preparing a save.
    ok('Borrador antiguo negativo no llega al guardado',page.evaluate("""()=>{
      decisionDrafts.PRESTAMO={amount:-150};decisionDrafts.MESA_CORTE={quantities:{mesa_1:-2}};
      const loan=initDraft(findDecisionItem('PRESTAMO')),asset=initDraft(findDecisionItem('MESA_CORTE'));
      return loan.amount===0&&asset.quantities.mesa_1===0;
    }"""))
    page.evaluate("""()=>{
      localStorage.setItem('SIDE_ACTIVE_ROUND','1');decisionDrafts={};decisionState={};
      localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));
      localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,running:true,startedAt:new Date().toISOString(),duration:600,remaining:600}));
      const config=teacherConfig();config.motor_version=SIDE_EXCEL_CONFIG.MOTOR_ACTUAL;
      localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(config));currentCategory='B';openDecisionMenu();
    }""")
    ok('Editor actual abierto para una partida operativa',page.evaluate("studentAccess().canOperate&&!document.getElementById('decisionMenu').classList.contains('hidden')"))
    for cat,selectors in [('B',['[data-activo]']),('C',['[data-lote][data-campo=cantidad]','[data-personal]']),('F',['[data-compra]']),('D',['[data-lote][data-campo=precio]','[data-excel-tienda]']),('E',['[data-excel-prestamo]'])]:
        category(cat);page.locator('#excelEditorTitle').wait_for(state='attached')
        page.locator('#excelProductionMount details').evaluate_all('(els)=>els.forEach(el=>el.open=true)')
        for selector in selectors:
            field=page.locator(selector).first
            if field.count():
                field.fill('-15');expect(field).to_have_value('0')
        ok(f'Editor actual {cat}: campos no negativos')
    field=page.locator('[data-excel-prestamo]');field.fill('123.45')
    ok('Editor actual conserva préstamo decimal positivo',page.evaluate('decisionState.__excel.decisiones.montoPrestamo===123.45'))
    ok('Planes guardados normalizan montos y cantidades sin tocar resultados',page.evaluate("""()=>{
      const d=SIDE_EXCEL_UI.nuevasDecisiones();d.montoPrestamo=-20;d.personal.corte[0][0]=-2;d.comprasUnidades['INS-01']=-3;d.maquinaria.mesa=-1;d.tiendasPorDistrito.los_olivos=-2;d.lotes[0].precio=-99;d.lotes[0].cantidad=-5;
      const saved=SIDE_EXCEL_UI.prepararDecisiones(d);
      return saved.montoPrestamo===0&&saved.personal.corte[0][0]===0&&saved.comprasUnidades['INS-01']===0&&saved.maquinaria.mesa===0&&saved.tiendasPorDistrito.los_olivos===0&&saved.lotes[0].precio===0&&saved.lotes[0].cantidad===0&&d.montoPrestamo===-20;
    }"""))
    ok('Precios del panel 3D tampoco aceptan negativos',page.locator('#price-esencial-input').evaluate("el=>{el.value='-40';el.dispatchEvent(new Event('input',{bubbles:true}));return el.value==='0';}"))
    page.screenshot(path=str(OUT/'prestamo.png'))
    ok('Sin errores JavaScript',not errors)
    browser.close()
(OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
