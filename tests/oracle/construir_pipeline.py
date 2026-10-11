"""Genera fórmulas Excel multiciclo desde decisiones, nunca resultados SIDE.

Alcance verificado: un lote de identidad estable por empresa, hasta tres ciclos,
stock individual por insumo y matriz completa de personal.
"""
import json
from pathlib import Path
import openpyxl
from openpyxl.utils import get_column_letter as letter

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'tests/oracle'

def construir(escenario,config):
    cfg={**config,**escenario.get('overrides',{})}
    name=escenario['id'].lower().replace('-','')
    book=openpyxl.load_workbook(DIR/'ORACULO_SIDE.xlsx')
    sh=book.create_sheet('Pipeline_'+name)
    cat=book['Catalogo_Decisiones']
    # Normalizar costos texto sin cambiar catálogo original: tabla auxiliar vinculada.
    catalog=book.create_sheet('Catalogo_Numerico_'+name)
    for row in range(1,70):
        for col in range(1,13):
            catalog.cell(row,col,f"='Catalogo_Decisiones'!{letter(col)}{row}")
        if row>1:catalog.cell(row,7,f'=IFERROR(VALUE(SUBSTITUTE(SUBSTITUTE(Catalogo_Decisiones!G{row},"S/",""),",","")),0)')
    headers={}
    def col(key):
        if key not in headers:
            headers[key]=len(headers)+1;sh.cell(1,headers[key],key)
        return letter(headers[key])
    def addr(key,r):return f'{col(key)}{r}'
    def setv(key,r,val):sh.cell(r,headers.setdefault(key,len(headers)+1),val);sh.cell(1,headers[key],key)
    def form(key,r,expr):setv(key,r,'='+expr)
    def look(code,which):return f'IFERROR(INDEX(\'{catalog.title}\'!${which}$2:${which}$69,MATCH({code},\'{catalog.title}\'!$A$2:$A$69,0)),0)'
    def quoted(value):return '"'+str(value).replace('"','""')+'"'
    previous={};decisions_last={};activos_conservados={};eliminated=set();rows=[];outputs={};replicas=[]
    codes=list(cfg['PRECIO_MP']);families=cfg['INSUMOS_POR_FAMILIA']
    cost_sheet=book.sheetnames[6]
    for cycle,phase in enumerate(escenario['ciclos'],1):
        for company in escenario['empresas']:
            id=company if isinstance(company,str) else company['id']
            if id in eliminated:continue
            decisions=phase.get('decisionesPorEmpresa',{}).get(id)
            if decisions is None:
                if id not in decisions_last:eliminated.add(id);continue
                decisions=decisions_last[id];replicas.append({'ciclo':cycle,'empresa':id})
            decisions_last[id]=decisions
            lots=decisions.get('lotes',[])
            if len(lots)!=1:raise ValueError(f'{id}: oráculo pipeline requiere exactamente un lote, recibió {len(lots)}')
            lot=lots[0];identity=tuple(lot.get(k,'') for k in ['segmento','molde','cuero','accesorios','hilo'])
            prev=previous.get(id)
            if prev and prev['identity']!=identity and not escenario.get('permitir_identidades'):raise ValueError(f'{id}: identidad del lote cambia; ampliar oráculo antes de afirmar paridad')
            r=len(rows)+2;R=lambda key:addr(key,r);P=lambda key:addr(key,prev['row']) if prev else '0'
            setv('ciclo',r,cycle);setv('empresa',r,id);setv('grupoMercado',r,f'{cycle}|{lot["segmento"]}')
            for key in ['segmento','molde','cuero','accesorios','hilo']:setv(key,r,lot.get(key,''))
            setv('planeado',r,lot.get('cantidad',0));setv('precio',r,lot.get('precio',0));setv('jefes',r,decisions.get('jefes',0));setv('publicidad',r,decisions.get('publicidad',0));setv('regimen',r,decisions.get('regimen','MYPE'))
            selection=decisions.get('seleccion',[])
            for i in range(18):setv(f'seleccion{i}',r,selection[i] if i<len(selection) else '')
            selection_refs=[R(f'seleccion{i}') for i in range(18)]
            # El catálogo literal conserva 68 filas; el Motor usa los grupos autorizados.
            catalog_groups={cat.cell(j,1).value:cat.cell(j,3).value for j in range(2,70)}
            selected=[selection_refs[i] for i,code in enumerate(selection[:18]) if catalog_groups.get(code) in cfg['GRUPOS_MOTOR']]
            for key,column in [('puntajeEficiencia','I'),('reputacionBase','J'),('saludFinanciera','K')]:form(key,r,'+'.join(look(code,column) for code in selected) or '0')
            form('calidad',r,'+'.join(look(R(k),'H') for k in ['cuero','accesorios','hilo','molde']))
            form('reputacionCambio',r,f'IF(AND({R("segmento")}="SEG-03",{R("planeado")}>0),IF({R("calidad")}<4,-2,IF({R("calidad")}>=7,2,0)),0)')
            form('precioFactor',r,f'IF(AND({R("segmento")}="SEG-03",{R("planeado")}>0),IF({R("calidad")}<4,0.65,IF({R("calidad")}>=7,1.4,1)),1)')
            form('reputacionMatriz',r,f'{R("reputacionBase")}+{R("reputacionCambio")}')
            form('ciclosReputacionBaja',r,f'IF({R("reputacionMatriz")}<3,{P("ciclosReputacionBaja")}+1,0)')
            form('factorDemanda',r,f'IF({R("ciclosReputacionBaja")}>={cfg["CONSECUENCIAS"]["CICLOS_REPUTACION"]},0.8,1)')
            form('tasaAdicionalPP',r,f'IF({R("saludFinanciera")}<3,{cfg["TEA_ADICIONAL_PP"]},0)')
            setv('montoPrestamo',r,max(0,decisions.get('montoPrestamo',0)) if 'FIN-01A' in selection else 0)
            setv('teaBase',r,decisions.get('teaBase',cfg['TEA_BASE']))
            form('tasaTEA',r,f'{R("teaBase")}+{P("penalizacionPendiente")}')
            form('deudaPrincipal',r,f'{P("deudaPrincipal")}+{R("montoPrestamo")}')
            form('penalizacionPendiente',r,f'IF({R("montoPrestamo")}>0,{R("tasaAdicionalPP")},MAX({P("penalizacionPendiente")},{R("tasaAdicionalPP")}))')
            form('factorConsecuencias',r,f'IF({R("puntajeEficiencia")}<4,0.7,1)*IF(AND({R("jefes")}=0,{R("puntajeEficiencia")}<5),0.95,1)')
            personal=decisions.get('personal',{})
            for area in ['corte','ensamble','acabado']:
                for n in range(3):
                    row=personal.get(area,[])[n] if n<len(personal.get(area,[])) else 0
                    row=row if isinstance(row,list) else [row,0,0]
                    for m in range(3):setv(f'{area}{n}{m}',r,row[m] if m<len(row) else 0)
                terms=[f'{R(f"{area}{n}{m}")}*{cfg["PRODUCTIVIDAD"][area][n]}*{1 if area=="corte" else cfg["MULTIPLICADORES_MAQUINA"][m]}' for n in range(3) for m in (range(1) if area=='corte' else range(3))]
                form('capacidad_'+area,r,'+'.join(terms))
            form('trabajadores',r,'+'.join(R(f'{a}{n}{m}') for a in ['corte','ensamble','acabado'] for n in range(3) for m in (range(1) if a=='corte' else range(3))))
            form('n3',r,'+'.join(R(f'{a}2{m}') for a in ['corte','ensamble','acabado'] for m in (range(1) if a=='corte' else range(3))))
            form('factorEficiencia',r,f'{cfg["EFICIENCIA_BASE"]}+({R("corte20")}+{R("ensamble20")}+{R("acabado20")})*{cfg["BONO_N3"]}+{R("jefes")}*{cfg["BONO_JEFATURA"]}')
            form('capacidadDiaria',r,f'MIN({R("capacidad_corte")},{R("capacidad_ensamble")},{R("capacidad_acabado")})')
            form('capacidadCiclo',r,f'{R("capacidadDiaria")}*{cfg["DIAS_CICLO"]}*{1+cfg["BONO_CAPACIDAD_RRHH"] if "INV-01B" in selection else 1}')
            form('produccionCapacidad',r,f'ROUND({R("capacidadCiclo")}*{R("factorEficiencia")},0)')
            for code in codes:
                initial=P('stockMP_'+code) if prev else str(decisions.get('inventarioInicial',{}).get(code,0))
                buy=decisions.get('compras',{}).get(code,0);units=decisions.get('comprasUnidades',{}).get(code,0)
                setv('comprado_'+code,r,buy+units*cfg['CONVERSION_COMPRA'][code]);form('disponible_'+code,r,f'{initial}+{R("comprado_"+code)}')
            consumption=cfg['CONSUMO_MOLDE'][lot['molde']]
            limits=[]
            for family,famcodes in families.items():
                chosen=lot.get(family)
                eligible=[chosen] if chosen else famcodes
                form('limite_'+family,r,'('+('+'.join(R('disponible_'+c) for c in eligible))+f')/{consumption[family]}')
                limits.append(R('limite_'+family))
            form('producidoPre',r,f'ROUNDDOWN(MIN({R("planeado")},{R("produccionCapacidad")},{",".join(limits)}),0)')
            form('producido',r,f'ROUNDDOWN({R("producidoPre")}*{R("factorConsecuencias")},0)')
            for family,famcodes in families.items():
                form('consumo'+family.capitalize(),r,f'{R("producido")}*{consumption[family]}')
                used=[]
                for code in famcodes:
                    formula='0'
                    if not lot.get(family) or lot.get(family)==code:
                        remaining=f'{R("consumo"+family.capitalize())}'+('-(%s)'%'+'.join(used) if used else '')
                        formula=f'MIN({R("disponible_"+code)},MAX(0,{remaining}))'
                    form('usado_'+code,r,formula);used.append(R('usado_'+code))
                    form('stockMP_'+code,r,f'{R("disponible_"+code)}-{R("usado_"+code)}')
            # Referencias directas a las fórmulas laborales originales.
            labor=[]
            for area,cm,cn in [('corte','U','V'),('ensamble','Y','Z'),('acabado','AC','AD')]:
                for n,source_row in enumerate([11,20,29]):
                    count='+'.join(R(f'{area}{n}{m}') for m in range(3))
                    labor.append(f'({count})*IF({R("regimen")}="NO_MYPE",\'{cost_sheet}\'!{cn}{source_row},\'{cost_sheet}\'!{cm}{source_row})')
            labor += [f'{R("jefes")}*IF({R("regimen")}="NO_MYPE",\'{cost_sheet}\'!V39,\'{cost_sheet}\'!U39)']
            if decisions.get('limpieza',True):labor += [f'IF({R("regimen")}="NO_MYPE",\'{cost_sheet}\'!Z39,\'{cost_sheet}\'!Y39)']
            if decisions.get('local',True):labor += [f'\'{cost_sheet}\'!AC33']
            form('costoMO',r,'('+('+'.join(labor))+f')*{cfg["CICLO_EQUIVALE_A_MESES"]}')
            factor=(1-cfg['DESCUENTO_CANTIDAD'])*(1-cfg['DESCUENTO_PROVEEDOR_UNICO'] if 'INS-09A' in selection else 1)*(1-cfg['DESCUENTO_CONTADO'] if 'INS-10A' in selection else 1)
            if decisions.get('analistaCompras'):
                analyst=cfg['ANALISTA_BASE'];factor*=1-max(analyst['descuentoMinimoPct'],analyst['descuentoInicialPct']-(cycle-1)*analyst['reduccionPorCicloPct'])/100
            form('costoMP',r,'('+('+'.join(f'{R("usado_"+c)}*{cfg["PRECIO_MP"][c]}' for c in codes))+f')*{factor}')
            maintenance=[];depreciation=[]
            method=next((c for c in selection if c.startswith('FIN-02') and catalog_groups.get(c) in cfg['GRUPOS_MOTOR']),'FIN-02A')
            rates=cfg['TASAS_ACTIVOS']['NO_MYPE' if decisions.get('regimen')=='NO_MYPE' else 'MYPE']
            activos_actuales=dict(activos_conservados.get(id,{}))
            for code,count in decisions.get('maquinaria',{}).items():
                activos_actuales[code]=max(activos_actuales.get(code,0),count)
            activos_conservados[id]=activos_actuales
            for code,count in activos_actuales.items():
                eq=cfg['MAQUINARIA'][code];base=eq['costo']*(1-rates['residual']);life=eq['vida']
                maintenance.append(f'{count}*{eq["costo"]}*{rates["mantenimiento"]}/{cfg["MESES_ANIO"]}*{cfg["CICLO_EQUIVALE_A_MESES"]}')
                if method=='FIN-02B':dep=f'{base}*{R("producido")}/{cfg["UNIDADES_VIDA"]}'
                elif method=='FIN-02C':dep=f'{base}*({life}-MIN({life},MAX(1,ROUNDUP({cycle}*{cfg["CICLO_EQUIVALE_A_MESES"]}/{cfg["MESES_ANIO"]},0)))+1)/({life}*({life}+1)/2)/{cfg["MESES_ANIO"]}*{cfg["CICLO_EQUIVALE_A_MESES"]}'
                else:dep=f'{base}/{life}/{cfg["MESES_ANIO"]}*{cfg["CICLO_EQUIVALE_A_MESES"]}'
                depreciation.append(f'{count}*({dep})')
            if 'mantenimientoPreventivo' not in decisions:
                maintenance += [look(selection_refs[i],'G') for i,c in enumerate(selection[:18]) if c.startswith('INF-11')]
            if decisions.get('mantenimientoPreventivo'):
                maintenance.append(str(cfg['COSTO_MANTENIMIENTO_BASE']))
            form('mantenimiento',r,'+'.join(maintenance) or '0');form('depreciacion',r,'+'.join(depreciation) or '0')
            proportions=[]
            for family,famcodes in families.items():
                denominator=famcodes[1:] if family=='hilo' and cfg.get('REPUTACION_HILO_DENOMINADOR_LITERAL') else famcodes
                proportions.append(f'IFERROR({R("usado_"+famcodes[-1])}/({"+".join(R("usado_"+c) for c in denominator)}),0)')
            form('reputacionOperativa',r,f'IF({R("producido")}>0,{10 if lot["molde"]=="INF-10" else 0},0)+IFERROR({R("n3")}/{R("trabajadores")},0)*10+({"+".join(proportions)})/3*10+{R("publicidad")}/10000*10')
            source=R('reputacionBase') if cfg['REPUTACION_FUENTE_MERCADO']=='motor' else R('reputacionOperativa')
            if cfg['REPUTACION_FUENTE_MERCADO']=='excel_literal':source=str(decisions.get('reputacionLiteral',0))
            form('reputacionMercado',r,f'{source}+{R("reputacionCambio")}')
            form('stockProductoAntes',r,f'{P("inventarioProducto")}+{R("producido")}')
            m=cfg['MERCADOS'][lot['segmento']]
            for key,value in [('mercadoReal',m['unidades']*m['penetracion']),('precioIdeal',m.get('precioIdeal',0))]:setv(key,r,value)
            # Intervalos se completan cuando se conocen todas las filas.
            rows.append({'r':r,'id':id,'cycle':cycle,'segment':lot['segmento'],'selection':selection,'m':m,'decisions':decisions})
            previous[id]={'row':r,'identity':identity}
    last=len(rows)+1
    for item in rows:
        r=item['r'];R=lambda key:addr(key,r);m=item['m'];selection=item['selection'];d=item['decisions']
        group_range=f'${col("grupoMercado")}$2:${col("grupoMercado")}${last}'
        price_range=f'${col("precio")}$2:${col("precio")}${last}'
        maxp=f'_xlfn.MAXIFS({price_range},{group_range},{R("grupoMercado")})';minp=f'_xlfn.MINIFS({price_range},{group_range},{R("grupoMercado")})'
        form('puntajePrecio',r,f'IF({R("segmento")}="SEG-01",IFERROR(100*({maxp}-{R("precio")})/({maxp}-{minp}),100),100-ABS({R("precio")}-{R("precioIdeal")})/{R("precioIdeal")}*100)')
        form('calidadMercado',r,f'ROUND(MIN(100,{R("calidad")}*10),0)')
        form('puntajeTotal',r,f'{m["pesos"][0]}*{R("puntajePrecio")}+{m["pesos"][1]}*{R("reputacionMercado")}*10+{m["pesos"][2]}*{R("calidadMercado")}')
        totals=f'${col("puntajeTotal")}$2:${col("puntajeTotal")}${last}'
        form('porcentaje',r,f'IFERROR({R("puntajeTotal")}/SUMIF({group_range},{R("grupoMercado")},{totals}),0)')
        form('asignado',r,f'ROUND({R("porcentaje")}*{R("mercadoReal")},0)')
        form('demandaAjustada',r,f'MAX(0,ROUNDDOWN({R("asignado")}*{R("factorDemanda")}*{1+cfg["BONO_DEMANDA_MARKETING"] if "INV-02B" in selection else 1},0))')
        form('vendido',r,f'MIN({R("stockProductoAntes")},{R("demandaAjustada")})')
        form('ingresos',r,f'{R("vendido")}*{R("precio")}*{R("precioFactor")}')
        form('inventarioProducto',r,f'{R("stockProductoAntes")}-{R("vendido")}')
        form('almacenaje',r,f'{R("inventarioProducto")}*{cfg["COSTO_ALMACENAJE_UNIDAD"]}')
        form('horasExtra',r,f'IF({R("planeado")}>{R("produccionCapacidad")},{cfg["HORAS_EXTRA_PCT"]}*{R("costoMO")}*IFERROR(MIN(1,({R("planeado")}-{R("produccionCapacidad")})/{R("produccionCapacidad")}),1),0)')
        warranty=next((c for c in selection if c.startswith('COM-06')),'')
        # Las opciones base GARANTIA_PT no tenían efecto de caja. No inventar una provisión.
        form('costoGarantia',r,'0' if 'garantiaDias' in d else f'{look(quoted(warranty),"G")}*{R("vendido")}')
        recurring=[c for c in selection if c in cfg.get('CODIGOS_COSTO_RECURRENTE',[]) and catalog_groups.get(c) in cfg['GRUPOS_MOTOR'] and not ('marketingNivel' in d and catalog_groups.get(c)=='Inversion en marketing')]
        form('costoRecurrente',r,'('+('+'.join(look(quoted(c),'G') for c in recurring) or '0')+f')*{cfg["CICLO_EQUIVALE_A_MESES"]}')
        form('costoLeadTime',r,('('+('+'.join(f'{R("comprado_"+c)}*{cfg["PRECIO_MP"][c]}' for c in codes))+')*'+str((1-cfg['DESCUENTO_CANTIDAD'])*(1-cfg['DESCUENTO_PROVEEDOR_UNICO'] if 'INS-09A' in selection else 1)*(1-cfg['DESCUENTO_CONTADO'] if 'INS-10A' in selection else 1)*cfg['LEAD_TIME_SOBRECOSTO'])) if 'INS-11A' in selection else '0')
        setv('costoAnalista',r,cfg['ANALISTA_BASE']['costo']*cfg['CICLO_EQUIVALE_A_MESES'] if d.get('analistaCompras') else 0)
        form('costosTotales',r,'+'.join(R(k) for k in ['costoMO','costoMP','mantenimiento','depreciacion','publicidad','almacenaje','horasExtra','costoGarantia','costoRecurrente','costoLeadTime','costoAnalista']))
        form('utilidad',r,f'{R("ingresos")}-{R("costosTotales")}')
        for i,expr in enumerate([f'AND({R("segmento")}="SEG-03",{R("calidad")}<4,{R("planeado")}>0)',f'AND({R("segmento")}="SEG-03",{R("calidad")}> =7,{R("planeado")}>0)'.replace('> =','>='),f'{R("puntajeEficiencia")}<4',f'{R("ciclosReputacionBaja")}> =2'.replace('> =','>='),f'{R("saludFinanciera")}<3',f'{R("planeado")}>{R("produccionCapacidad")}',f'{R("producido")}>{R("vendido")}',f'AND({R("jefes")}=0,{R("puntajeEficiencia")}<5)'],1):
            form(f'CONS-{i:02}',r,expr)
        fields=['calidad','puntajeEficiencia','reputacionMatriz','saludFinanciera','capacidadDiaria','capacidadCiclo','factorEficiencia','produccionCapacidad','producido','consumoCuero','consumoAccesorios','consumoHilo','costoMO','costoMP','mantenimiento','depreciacion','reputacionOperativa','reputacionMercado','asignado','demandaAjustada','vendido','ingresos','inventarioProducto','almacenaje','horasExtra','costoGarantia','costoRecurrente','costosTotales','utilidad','ciclosReputacionBaja','tasaAdicionalPP']+[f'stockMP_{c}' for c in codes]+[f'CONS-{i:02}' for i in range(1,9)]
        outputs.update({f'ciclo.{item["cycle"]}.{item["id"]}.{key}':[sh.title,R(key)] for key in fields})
        outputs.update({f'ciclo.{item["cycle"]}.{item["id"]}.financiamiento.{key}':[sh.title,R(column)] for key,column in [('montoPrestamo','montoPrestamo'),('tasaTEA','tasaTEA'),('deudaPrincipal','deudaPrincipal'),('tasaAdicionalProximoPrestamo','penalizacionPendiente')]})
    sh.freeze_panes='D2'
    for c in range(1,len(headers)+1):sh.column_dimensions[letter(c)].width=20
    book.save(DIR/f'ORACULO_{name}.xlsx')
    plan={'nombre':name+'_pipeline','modelo':f'ORACULO_{name}.xlsx','entradas':{},'salidas':outputs}
    (DIR/f'escenario_{name}_pipeline.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    (DIR/f'flujo_{name}.json').write_text(json.dumps({'eliminadas':sorted(eliminated),'replicadas':replicas,'filas':len(rows)},ensure_ascii=False,indent=2),encoding='utf-8')
    return name,plan

if __name__=='__main__':
    import sys
    if len(sys.argv)>1 and sys.argv[1] in ['banca','bancamezcla']:
        input_path='entradas_banca_recuperacion.json' if sys.argv[1]=='banca' else 'entradas_banca_mezcla.json'
        data=json.loads((DIR/input_path).read_text(encoding='utf-8-sig'))
        name,plan=construir(data['escenario'],data['config'])
        print(name,len(plan['salidas']))
        raise SystemExit(0)
    data=json.loads((DIR/'entradas_simulaciones.json').read_text(encoding='utf-8-sig'))
    for scenario in data['escenarios']:
        name,plan=construir(scenario,data['config'])
        print(name,len(plan['salidas']))
