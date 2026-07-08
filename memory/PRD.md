# NexoPro — ERP Base (Clientes, Proveedores, Facturación, Verifactu)

## Problema original
ERP base en español: clientes, proveedores, pedidos, albaranes y facturación, compatible con Verifactu.
Módulo base extensible a módulos sectoriales. Alta automática de pedidos/albaranes/facturas recibidas
desde PDF del proveedor mediante IA. Stack: FastAPI + React + MongoDB (Python para la lógica/IA).

## Arquitectura
- Backend: FastAPI (`/app/backend/server.py`), rutas con prefijo `/api`, MongoDB (motor).
  Colecciones: contactos, articulos, pedidos, albaranes, facturas_emitidas, facturas_recibidas.
- Frontend: React + Tailwind + shadcn/ui. Menú superior (Layout.jsx). Fuentes: Cabinet Grotesk + IBM Plex Sans.
- IA: Gemini (gemini-2.5-flash) vía emergentintegrations + EMERGENT_LLM_KEY para extracción de PDF.
- Marca: "NexoPro", logo en customer-assets (favicom.png).

## Personas
Autónomos y pymes españolas que gestionan compras/ventas y facturación con obligación Verifactu.

## Implementado (2026-07-08)
- CRUD Clientes (con datos bancarios IBAN/banco/SWIFT y dirección de entrega) y Proveedores.
- Alta automática de cliente al crear factura/albarán/pedido de VENTA con nombre nuevo (ensure_cliente).
- Artículos: referencia AUTOMÁTICA (ART-000000), código proveedor, código de barras/QR con vista previa.
  Alta automática de artículos desde documentos de ENTRADA (marca AUTO + a qué documentos corresponde).
- Líneas de documentos con columna "Cód. prov." (código del artículo del proveedor).
- CRUD Artículos/Productos + alta automática de artículos desde albaranes/facturas de ENTRADA
  (marca AUTO y guarda a qué documento(s) corresponde cada artículo).
- Pedidos y Albaranes con líneas + totales. Albaranes con pestañas Recibidos (IA)/Emitidos.
- Facturas Emitidas con Verifactu: numeración por serie, huella SHA-256 encadenada, QR AEAT, estado cobro.
- Facturas Recibidas: alta manual o por IA desde PDF; estado de pago.
- Extracción IA de PDF (proveedor, nº, fecha, líneas, totales) con emparejado de proveedor por NIF.
- Panel "Panel de control" con KPIs, gráfico de facturación mensual y últimas facturas.
- Menú superior con marca NexoPro + logo.
- LICENCIAS + PANEL CENTRAL (2026-07-08): auth admin JWT (email+password), panel oculto en /admin
  para gestionar clientes/licencias (crear, activar/suspender, registrar pago manual, cuota mensual).
  Gate de licencia en el ERP: si la licencia del cliente se suspende, la app se bloquea con aviso.
  Admin: admin@nexopro.com / Admin1234!. Licencia demo: NEXO-DEMO-0001 (frontend/.env REACT_APP_LICENSE_KEY).

## Estado / Bloqueos
- FLUJO ENLAZADO + DOCUMENTOS IMPRIMIBLES + LOGO (2026-07-08):
  · Conversión con un clic: Presupuesto→Pedido/Albarán; Pedido→Albarán; Albarán→Factura
    (venta→factura emitida, compra→factura recibida). Backend POST /api/documentos/{entidad}/{id}/convertir
    (convertir_documento, mapa _TRANSICIONES, bloquea doble conversión, enlaza origen/factura). UI: menú "Convertir".
  · Facturas Emitidas: banner de aviso + AlertDialog de confirmación antes de crear factura directa (no borrables).
  · Logo de empresa en Ajustes: subida de imagen (base64, máx 600KB) guardada en empresa.logo.
  · Documentos y listados imprimibles: /app/frontend/src/lib/print.js (imprimirDocumento / imprimirListado)
    abren ventana con logo, nombre del documento, datos y distinción VENTA (indigo) / COMPRA (ámbar).
    Botón "Imprimir" en las 8 páginas de listado + icono imprimir por fila.
  · Conciliación de compras: al crear factura recibida se pueden seleccionar albaranes de compra pendientes
    (GET /api/albaranes-compra-pendientes) y se muestra "Coincide/No coincide" (suma vs total, tolerancia 0.01€);
    los albaranes seleccionados quedan enlazados y facturados. Columna "Conciliación" en la lista.
  Verificado testing_agent iteration_8 (backend 9/9, frontend 100%).
- FAMILIAS VENTAS/COMPRAS + PRESUPUESTOS (2026-07-08): navegación reorganizada en dos familias.
  Artículos arriba (sin "Catálogo"). VENTAS: Clientes, Presupuestos (NUEVO), Pedidos, Albaranes, Facturas.
  COMPRAS: Proveedores, Pedidos, Albaranes, Facturas. Documentos.jsx ahora recibe props entidad+operacion
  (rutas /ventas/* y /compras/*, sin pestañas). Backend: nueva colección "presupuestos" (prefijo PRE),
  contador "presupuestos" añadido a series_venta. Verificado testing_agent iteration_7 (backend 7/7, frontend 100%).
- CONSUMO IA MOVIDO AL PANEL ADMIN (2026-07-08): se quitó el widget de Facturas Recibidas. Nuevo endpoint
  GET /api/admin/consumos-ia (auth) que agrega el consumo POR cliente/licencia (join con licencias).
  Sección "Consumo de IA" en /admin con KPIs + tabla por cliente. POST /extraccion/pdf ahora recibe y
  guarda el license_key de cada lectura (los consumos históricos sin licencia salen como "Sin identificar").
- REDISEÑO UI/UX COMPLETO (2026-07-08): estética profesional indigo/zinc con sidebar en TODAS las páginas.
  Componente Pill reutilizable. LineasEditor con anchos CSS-grid alineados.
- AJUSTES + SERIES (2026-07-08): sección "Ajustes" (/ajustes). Datos de empresa + numeración de series de
  VENTA (presupuestos/pedidos/albaranes/facturas) y COMPRA (pedidos/albaranes) con "próximo número" editable
  por tipo y serie por defecto. Numeración generada desde estos contadores (_siguiente_contador, $inc atómico).

## Backlog / Próximos pasos (P1/P2)
- (P1) Flujo enlazado: presupuesto → pedido → albarán → factura (venta) y pedido → albarán → factura (compra).
- Convertir pedido→albarán→factura (flujo enlazado).
- Conexión real a Verifactu/AEAT (certificado digital, entorno producción).
- Exportar factura a PDF y envío por email (Resend/SendGrid).
- Autenticación multiusuario y roles.
- Adjuntar/visualizar el PDF original en la ficha de factura recibida.
- Recepción automática de PDFs por email del proveedor (buzón de entrada).
