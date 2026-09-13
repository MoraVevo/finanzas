# -*- coding: utf-8 -*-
# TarjetaDia: carrusel real (slides animadas) con 3 vistas — Día/Estructura/Fijos
# (se elimina Margen), indicador de puntos con guión activo, swipe nativo.
import io

ruta = 'js/screens/estadisticas.js'
src = io.open(ruta, encoding='utf-8').read()

lineas = src.split('\n')
inicio = next(i for i, l in enumerate(lineas) if l.startswith('function TarjetaDia'))
fin = next(i for i, l in enumerate(lineas) if l.startswith('/* ---------- Gráficas de la vista Mes'))

NUEVO = '''function TarjetaDia({ st, est, clave, principal }) {
  const VISTAS = [['dia', 'Día'], ['estructura', 'Estructura'], ['cobertura', 'Fijos']];
  const orden = VISTAS.map(v => v[0]);
  const [vista, setVista] = useState('dia');
  const cardRef = useRef(null);
  // swipe nativo directo: gestos fiables en iOS
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let x = null, y = null;
    const ini = e => { x = e.touches[0].clientX; y = e.touches[0].clientY; };
    const fin = e => {
      if (x == null) return;
      const dx = e.changedTouches[0].clientX - x;
      const dy = e.changedTouches[0].clientY - y;
      x = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
      setVista(v => {
        const i = orden.indexOf(v);
        return orden[(i + (dx < 0 ? 1 : -1) + orden.length) % orden.length];
      });
    };
    card.addEventListener('touchstart', ini, { passive: true });
    card.addEventListener('touchend', fin);
    return () => {
      card.removeEventListener('touchstart', ini);
      card.removeEventListener('touchend', fin);
    };
  }, []);

  const TITULOS = { dia: 'Gasto por día', estructura: 'Fijo vs variable · este mes', cobertura: 'Cobertura de tus fijos' };
  const idx = Math.max(0, orden.indexOf(vista));
  const r = est ? Math.round(est.fijoOut ? est.fijoIn / est.fijoOut * 100 : 0) : 0;
  const margen = est ? est.varIn - est.varOut : 0;
  const barra = (nom, val, color, maxV) => html`<div key=${nom} class="barra-fila">
    <div class="info"><span style=${{ fontSize: '12.5px' }}>${nom}</span><span class="num">${fmtConMoneda(val, principal)}</span></div>
    <div class="pista"><div class="lleno" style=${{ width: (val / maxV * 100) + '%', background: color }}></div></div>
  </div>`;
  const maxV = Math.max(1, est.fijoIn, est.varIn, est.fijoOut, est.varOut);

  return html`<div class="tarjeta" ref=${cardRef} style=${{ touchAction: 'pan-y' }}>
    <h3>${TITULOS[vista]}</h3>
    <${Segmentado} opciones=${VISTAS} valor=${vista} onChange=${setVista} />
    <div class="carrusel" style=${{ marginTop: '10px' }}>
      <div class="carrusel-track" style=${{ transform: `translateX(-${idx * 100}%)` }}>
        <div class="carrusel-slide">
          <${ChartDias} porDia=${st.porDia} diasMes=${diasMesDe(clave)} max=${Math.max(1, ...st.porDia.map(d => d.monto))} principal=${principal} />
        <//>
        <div class="carrusel-slide">
          ${barra('Ingresos fijos', est.fijoIn, 'var(--ingreso)', maxV)}
          ${barra('Ingresos variables', est.varIn, 'var(--ingreso)', maxV)}
          ${barra('Gastos fijos', est.fijoOut, 'var(--gasto)', maxV)}
          ${barra('Gastos variables', est.varOut, 'var(--gasto)', maxV)}
          <div class="dato-cuenta" style=${{ marginTop: '6px' }}>
            ${est.varOut > est.fijoOut && est.fijoOut > 0 ? 'Tus gastos fijos son bajos: lo fuerte está en lo variable — ahí está tu espacio de ahorro.'
              : est.fijoOut > est.varOut && est.fijoOut > 0 ? 'Tus gastos fijos dominan el mes: son tu base a cubrir sí o sí.'
              : 'Sin gastos fijos registrados este mes.'}
          <//>
        <//>
        <div class="carrusel-slide" style=${{ textAlign: 'center', padding: '8px 0 4px' }}>
          ${!est.tieneReglas && html`<div class="vacio">Configura tus ingresos y gastos fijos en Inicio (＋ Fijos) para ver este análisis.</div>`}
          ${est.tieneReglas && est.fijoOut === 0 && html`<div class="vacio">Este mes no tuviste gastos fijos: tus ingresos fijos quedaron enteros.</div>`}
          ${est.tieneReglas && est.fijoOut > 0 && html`<div>
            <div style=${{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Tus ingresos fijos cubren</div>
            <div class="num" style=${{ fontSize: '34px', fontWeight: 800, color: r >= 100 ? 'var(--ingreso)' : r >= 80 ? 'var(--warn)' : 'var(--gasto)' }}>${r}%</div>
            <div style=${{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '8px' }}>de tus gastos fijos (${fmtConMoneda(est.fijoIn, principal)} / ${fmtConMoneda(est.fijoOut, principal)})</div>
            <div class="barra-fila"><div class="pista"><div class="lleno" style=${{ width: Math.min(100, r) + '%', background: r >= 100 ? 'var(--ingreso)' : r >= 80 ? 'var(--warn)' : 'var(--gasto)' }}></div></div></div>
            <div class="dato-cuenta" style=${{ marginTop: '8px' }}>
              ${r >= 100 ? 'Tus fijos se pagan solos: estabilidad sólida.'
                : r >= 80 ? 'Casi: depende un poco de tus ingresos variables.'
                : 'Riesgo: vives mayormente de ingresos variables; si fallan, tus fijos no se cubren.'}
            <//>
          <//>`}
        <//>
      <//>
    <//>
    <div class="carrusel-puntos">
      ${orden.map(v => html`<button key=${v} type="button" aria-label=${TITULOS[v]}
        class=${'carrusel-punto' + (v === vista ? ' activo' : '')} onClick=${() => setVista(v)}><//>`)}
    <//>
  </div>`;
}

'''

lineas[inicio:fin] = [NUEVO.split('\n')]
io.open(ruta, 'w', encoding='utf-8').write('\n'.join(lineas))
print('TarjetaDia carrusel instalado')
