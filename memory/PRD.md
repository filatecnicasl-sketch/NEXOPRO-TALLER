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
- REDISEÑO UI/UX COMPLETO (2026-07-08): estética profesional indigo/zinc con sidebar aplicada a TODAS
  las páginas (Dashboard, Clientes/Proveedores, Artículos, Pedidos, Albaranes, Facturas Emitidas/Recibidas,
  ImportPdfDialog). Nuevo componente reutilizable Pill (estados). LineasEditor con anchos CSS-grid alineados.
- AJUSTES + SERIES (2026-07-08): nueva sección "Ajustes" (nav "Sistema" → /ajustes). Gestiona datos de
  empresa y numeración de series de VENTA (facturas/pedidos/albaranes) y COMPRA (pedidos/albaranes) con
  "próximo número" editable por tipo de documento y serie por defecto (estrella). Backend: singleton
  db.ajustes {empresa, series_venta, series_compra}; GET/PUT /api/ajustes; _siguiente_contador ($inc atómico);
  la numeración de facturas emitidas y documentos (pedidos/albaranes) se genera desde estos contadores.
  Selectores de serie conectados en FacturasEmitidas (input-serie) y Documentos (input-serie-doc).
  Verificado por testing_agent (iteration_6): backend 5/5, frontend 100% flujos probados.

## Backlog / Próximos pasos (P1/P2)
- (P1) Añadir en el Panel Admin central el consumo de tokens/créditos de IA POR licencia/cliente.
- (P1) Primer módulo sectorial (taller/hostelería/construcción) sobre este módulo base de facturación.
- Convertir pedido→albarán→factura (flujo enlazado).
- Conexión real a Verifactu/AEAT (certificado digital, entorno producción).
- Exportar factura a PDF y envío por email (Resend/SendGrid).
- Autenticación multiusuario y roles.
- Adjuntar/visualizar el PDF original en la ficha de factura recibida.
- Recepción automática de PDFs por email del proveedor (buzón de entrada).
