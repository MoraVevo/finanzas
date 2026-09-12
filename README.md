# ƒ Finanzas

App personal de finanzas: **local, privada, offline y sin suscripciones**. Tus datos viven en tu dispositivo.

## Qué es

- Registrar un gasto en segundos: botón **+** → monto con teclado propio → categoría → Guardar.
- Gastos, ingresos y **transferencias entre tus cuentas** (pagar la tarjeta NO es un gasto).
- Cuentas propias: efectivo, banco, ahorro, tarjeta de crédito y deudas — con banco/número/titular pre-registrados.
- Multimoneda: cada cuenta con su moneda; reportes en tu moneda principal usando tus propias tasas.
- Etiquetas/actividades (#carro, #viaje) para analizar gastos que cruzan categorías.
- Presupuestos por categoría, estadísticas por día/categoría/etiqueta/mes, patrimonio y deuda.
- Comprobante fotográfico por transacción (cámara o galería).
- **Tus datos son tuyos**: exportación CSV (Excel/Sheets), respaldo JSON completo (con o sin imágenes), importación, y "copiar para IA" (pega tus finanzas en ChatGPT para que las analice).

## Instalar en el iPhone

1. Publica la app (ver abajo) y ábrela en **Safari**.
2. Botón **Compartir** → **Añadir a pantalla de inicio**.
3. Listo: abre a pantalla completa y funciona **sin internet**.

## Publicarla (gratis)

Opción A — **GitHub Pages**:
1. Crea un repositorio en GitHub y sube todos estos archivos.
2. Settings → Pages → Branch `main` → Save.
3. Tu app queda en `https://TU_USUARIO.github.io/TU_REPO/`.

Opción B — **Cloudflare Pages** / Netlify: arrastra la carpeta, listo.

**Importante al publicar cambios:** edita `sw.js` y sube el número de `CACHE` (ej. `finanzas-v3` → `finanzas-v4`). Así todos los dispositivos descargan la versión nueva.

## Desarrollar localmente

No hay build ni dependencias que instalar. Solo sirve la carpeta:

```
python -m http.server 8123
```

y abre `http://localhost:8123`. (Los service workers requieren http/https, no `file://`.)

## Estructura

```
index.html            entrada
manifest.json         PWA (instalable)
sw.js                 service worker (offline; bump CACHE al publicar)
css/app.css           estilos (claro/oscuro automático)
vendor/               Preact+htm y Dexie (versionadas localmente, sin CDN)
js/
  db.js               esquema IndexedDB + CRUD + datos iniciales
  model.js            lógica pura: saldos, patrimonio, estadísticas, conversión
  util.js             fechas, montos, compresión de imágenes
  export.js           CSV / JSON / copiar-para-IA / importar
  store.js            estado global + router hash
  ui.js               componentes: teclado, pickers, hojas, comprobantes
  app.js              arranque, pestañas, botón +
  screens/            Hoy, Agregar, Movimientos, Estadísticas, Cuentas, Ajustes, Onboarding
img/                  íconos (gen-icons.ps1 los regenera)
```

## Modelo de datos (resumen)

- **Cuenta**: efectivo | bancaria | ahorro | tarjeta | deuda. Tarjetas/deudas van en negativo.
- **Transacción**: gasto | ingreso | transferencia. Monto en unidades mínimas (centavos) con su moneda; transferencias guardan cuenta de origen y destino.
- Fecha+hora, categoría, etiquetas, motivo y comprobantes son opcionales.
- Los registros usan UUID + `updatedAt` + borrado lógico: listos para sincronización futura sin rediseño.

## Respaldos (¡hazlos!)

Ajustes → **Mis datos** → *Respaldo JSON*. Guarda el archivo en Archivos/iCloud.
Recomendación: exportar una vez al mes. La importación restaura todo en un dispositivo nuevo.
