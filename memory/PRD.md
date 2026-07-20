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
- TALLER — VEHÍCULO ÚNICO POR MATRÍCULA + TRAZABILIDAD MÁXIMA (2026-07-20): RESUELTO Y VERIFICADO.
  · Bug: se podía dar de alta el mismo vehículo (misma matrícula) dos veces. Fix backend (server.py):
    crear_vehiculo devuelve 409 si la matrícula ya existe; actualizar_vehiculo valida unicidad con
    id!=vid (editar sin cambiar matrícula no da falso 409). El modelo Vehiculo ahora declara
    'propietarios: List[dict]' (antes NO se persistía → dead code). Histórico de propietarios:
    al cambiar el cliente en PUT se cierra 'hasta' del anterior y se añade el nuevo (varios dueños
    en el tiempo, misma matrícula única).
  · ficha_vehiculo (GET .../ficha) ahora agrega 'materiales' (líneas de las órdenes, flag es_material)
    y 'facturas' (facturas_emitidas por vehiculo_id) además de propietarios/ordenes/peritajes/
    presupuestos/compras/citas/prestamos.
  · Frontend Vehiculos.jsx: save() muestra el detail del servidor en el toast (mensaje de duplicado);
    ficha (Resumen) con secciones Propietarios (ficha-propietarios), Material asignado (ficha-materiales)
    y Facturas del vehículo (ficha-facturas); la línea de tiempo del Historial incluye eventos Material y
    Factura. Se añadió el useNavigate() que faltaba (botón 'Nuevo presupuesto' de la ficha).
  · Verificado testing_agent iteration_20 (backend 6/6, frontend E2E 100%).
  · PENDIENTE OPCIONAL: existen 2 filas antiguas con matrícula 7765HGJ (duplicado creado ANTES del fix,
    dato real del usuario). El fix impide NUEVOS duplicados pero no borra los existentes.
- FIX IMPRESIÓN (no imprimía) — RESUELTO Y VERIFICADO (2026-07-08):
  · open() en taller_print.js reescrita: iframe oculto con srcdoc=html e impresión en su evento
    onload (iframe.contentWindow.print()) + fallback setTimeout(1500) + fallback window.open si
    print() lanza. Se quitaron los <script>onload internos que no disparaban en iframe. Incrementa
    window.__printTriggered antes de imprimir (marcador de verificación).
  · Verificado por testing_agent (iteration_16.json, frontend 100%): Hoja de entrada, Parte de
    trabajo y Recepción rápida ("Imprimir hoja y finalizar") disparan la impresión (contador 1→2→3),
    iframe con contenido correcto (RESGUARDO / @page size:A4 landscape), sin popups ni errores JS.
  · Añadido DialogDescription en RecepcionRapida (aviso a11y de Radix resuelto).
  · Recepción rápida: botón final "Imprimir hoja y finalizar" (imprime + cierra) + "Cerrar sin imprimir".
  · Datos de ejemplo eliminados; empresa reseteada a vacío. Solo queda vehículo 7765HGJ y orden
    OT-000016 (del usuario).
- TALLER — HOJA DE ENTRADA A4 HORIZONTAL (réplica ASORECA) + IMPRESIÓN (2026-07-08):
  · imprimirHojaEntrada (taller_print.js) rehecha como réplica fiel del "Resguardo de depósito sin
    presupuesto" ASORECA: A4 HORIZONTAL, UN solo ejemplar, ocupa todo el folio (contenedor 190mm).
    Incluye: título, cabecera taller (nombre/CIF/dir/RIIA/mail/tel/fax) + bloque cliente, tabla
    REPARACIONES A REALIZAR (Nº/Descripción/Mano de obra/Materiales, 21 filas), datos vehículo +
    croquis (perfil+planta) + seguro/combustible/observaciones, recuadro RENUNCIA con texto legal y
    firmas prestador/cliente, fecha prevista de entrega, 4 casillas de autorización, y al pie
    Protección de Datos + gastos de estancia. Verificado por render (idéntico al original).
  · IMPRESIÓN: función open() cambiada de window.open (bloqueada por navegador) a IFRAME oculto que
    espera a que carguen las imágenes y llama a win.print(). Se quitaron los <script> onload internos
    (no disparaban en iframe y causaban que NO imprimiese). Confirmado por el usuario ("LISTO").
  · UI Órdenes: los 2 iconos de impresión (hoja/parte) sustituidos por un DropdownMenu "Imprimir" con
    opciones claras "Hoja de entrada (A4 horizontal)" y "Parte de trabajo".
  · Datos de EJEMPLO en BD para previsualizar: empresa "Taller Hnos. García S.L." (placeholder, el
    usuario debe poner la suya en Ajustes), cliente María López, vehículo 1234ABC, orden OT-000014.
    Existe también OT-000013 (7765HGJ) con texto de prueba del usuario.
- TALLER/UI — RECEPCIÓN RÁPIDA + BUSCADOR LÍNEAS + MENÚ COLOR (2026-07-08):
  · Recepción rápida (RecepcionRapida.jsx): botón en cabecera de Órdenes. Flujo 2 pasos pensado para
    tablet junto al coche: paso 1 (matrícula + marca/modelo + cliente existente o alta rápida + tipos +
    motivo) crea/reutiliza vehículo por matrícula y crea la orden; paso 2 muestra fotos (Cámara/Subir/QR)
    + firma en pantalla + "Imprimir hoja de entrada". Verificado E2E (crea OT, reutiliza 7765HGJ).
  · FotosGaleria: añadido botón "Cámara" (input capture=environment) para foto directa en tablet/móvil.
  · LineasEditor: al elegir artículo el CÓDIGO va en la columna izquierda (codigo_proveedor||referencia)
    y la descripción solo el nombre (antes "ref · nombre"). Columnas del grid reequilibradas (descripción
    ya no ocupa 6fr). Verificado por captura.
  · Layout.jsx: iconos del menú (ribbon) grandes (chip 56px, icono 32, duotone) y con COLOR propio por
    ítem (violet/emerald/blue/amber/cyan/teal/rose/indigo/slate vía mapa TONES con clases literales).
    Iconos de módulos (fila 1) también coloreados. Aprobado por el usuario.
- TALLER — RECEPCIÓN DIGITAL (firma en pantalla + fotos del estado) (2026-07-08):
  · Sección "Recepción digital" en el diálogo de Órdenes de trabajo (solo al editar una orden guardada):
    FotosGaleria tipo="ordenes" (subida directa + QR móvil, reutiliza infra existente) + SignaturePad.jsx
    (canvas táctil/ratón) para la firma de conformidad del cliente. Backend: POST/DELETE
    /api/taller/ordenes/{id}/firma (dataURL base64 → object storage → firma_cliente_path/firma_cliente_at).
    La hoja de entrada (imprimirHojaEntrada) muestra la firma digital sobre la línea de firma del cliente.
    Verificado E2E por captura (dibujo→guardar→se muestra sello fecha; firma sale en la hoja impresa).
- TALLER — HOJA DE ENTRADA EN PDF SERVIDOR (WeasyPrint) (2026-06 fork): RESUELTO bug recurrente
  de impresión (salía comprimida/deformada con impresión HTML en navegador). Ahora el backend
  genera un PDF real A4 horizontal vía WeasyPrint: GET /api/taller/ordenes/{oid}/hoja-entrada.pdf
  (@page size A4 landscape, dos ejemplares). Frontend: helper api.js hojaEntradaUrl(id); los botones
  de OrdenesTrabajo.jsx (dropdown data-testid hoja-entrada-{id}) y RecepcionRapida.jsx (rr-imprimir-
  finalizar) descargan el PDF con descargarPdf() (fetch→blob→anchor[download]), sin ventanas
  emergentes, fiable en todos los navegadores. ADEMÁS el "Parte de trabajo" también se generó como
  PDF servidor (GET /api/taller/ordenes/{oid}/parte-trabajo.pdf, A4 vertical, con fotos) y se descarga
  igual; se eliminó la impresión HTML en navegador (imprimirParteOrden/imprimirHojaEntrada ya no se
  usan). Verificado end-to-end por testing_agent (iteration_18: backend 4/4, frontend 3/3, 100%).
- TALLER — IMPRESIÓN DIRECTA (sin descarga) (2026-06 fork): a petición del usuario, los botones de
  impresión (Parte de trabajo, Hoja de entrada y Recepción rápida) ahora abren DIRECTAMENTE el diálogo
  de imprimir del navegador vía api.js imprimirPdf(url): fetch→blob→iframe oculto→contentWindow.print().
  Sin ventanas emergentes (evita el bloqueo de Radix dropdown) y sin descargar el archivo. Respaldo:
  si el navegador no permite print(), abre el PDF en pestaña nueva. Verificado (smoke test Chrome):
  clic "Imprimir orden" dispara GET parte-trabajo.pdf (200) y crea el iframe #__print_frame__.
  Objetivo del usuario: PC Windows + Chrome. Queda pendiente que el usuario confirme en su Chrome real.
- FIX ERR_BLOCKED_BY_CLIENT (2026-06 fork): el usuario veía "La página está bloqueada · ERR_BLOCKED_BY_CLIENT"
  en Chrome y Edge (extensión/antivirus bloqueando pestañas nuevas). Causa: el respaldo window.open.
  Solución: imprimirPdf() YA NO usa window.open en absoluto. Imprime vía iframe oculto + print(); si
  el iframe no puede imprimir, cae a DESCARGA (anchor download), nunca a pestaña nueva. Verificado
  (smoke test Chrome): clic imprimir → GET parte-trabajo.pdf 200, iframe #__print_frame__ creado,
  window.open llamado 0 veces.
- IMPRESIÓN DEFINITIVA POR HTML (2026-06 fork): el usuario tenía Acrobat como visor de PDF por
  defecto, así que cualquier PDF se descargaba (saturaba carpeta Descargas, poco profesional).
  Solución final: NO se imprime PDF. Backend expone versiones HTML: GET
  /api/taller/ordenes/{oid}/hoja-entrada.html y /parte-trabajo.html (reutilizan _build_resguardo_html
  y _build_parte_html, con imágenes incrustadas y @page A4). Frontend api.js imprimirDocumento(url):
  fetch HTML → iframe oculto (document.write) → contentWindow.print(). Sin descargas, sin pestañas,
  sin Acrobat. Los PDF (hoja-entrada.pdf/parte-trabajo.pdf) siguen existiendo por si se quieren guardar.
  Verificado (smoke test Chrome): clic imprimir → GET parte-trabajo.html 200, iframe creado,
  window.open 0 veces, ningún .pdf solicitado; HTML renderiza A4 horizontal correcto.
- IMPRESIÓN EN LA PROPIA PÁGINA (método definitivo, unificado) (2026-06 fork): el usuario seguía sin
  poder imprimir (Órdenes no abría; Ventas mostraba el HTML pero sin poder imprimir; ERR_BLOCKED_BY_CLIENT
  por extensión al abrir pestañas). Solución final y UNIFICADA para toda la app: api.js imprimirHtmlString(html)
  inyecta el documento oculto (#__print_root__) en la página actual + un <style> con @page y reglas
  @media print que ocultan todo salvo el documento, y llama a window.print() de la ventana PRINCIPAL
  (equivale a Ctrl+P). SIN iframe, SIN ventanas nuevas, SIN PDF, SIN Acrobat → inmune a bloqueos de
  extensiones. imprimirDocumento(url)=fetch+imprimirHtmlString. Aplicado a: Órdenes (parte y hoja vía
  endpoints .html del backend), Recepción rápida, Documentos de Ventas/Compras (lib/print.js) y Peritajes
  (lib/taller_print.js) — todos usan imprimirHtmlString. Se eliminó todo window.open del frontend.
  Verificado (smoke test Chrome): Órdenes y Ventas → window.print() llamado 1 vez, documento inyectado,
  window.open 0, pantalla de la app intacta. PENDIENTE: confirmar en el Chrome real del usuario (si su
  navegador imprime cualquier web con Ctrl+P, este método funcionará).

- TALLER — HOJA DE ENTRADA + BUSCADOR DE ARTÍCULOS + CONFIRMAR CITA (2026-07-08):
  · Hoja de entrada/recepción de vehículo (lib/taller_print.js imprimirHojaEntrada): A4 con DOS
    ejemplares (TALLER + CLIENTE) en la misma hoja, con datos taller/cliente/vehículo (matrícula,
    marca/modelo, bastidor, color, km, combustible), fecha/hora, trabajos solicitados, CROQUIS del
    coche (SVG) para marcar daños, objetos de valor, presupuesto máx., aviso legal RGPD + retención
    art.1600 CC, y firmas. Botón "hoja-entrada" (icono ClipboardText) en cada fila de Órdenes de
    trabajo. Sin campos nuevos en BD (usa datos existentes + líneas en blanco para rellenar a mano).
    Verificado por render de captura (2 ejemplares OK).
  · Buscador de artículos en LineasEditor.jsx: botón "Buscar artículo" + lupa por línea que abren
    diálogo con búsqueda en tiempo real (referencia/nombre/cód. barras/cód. proveedor) y selección
    con un clic que rellena la línea. Sustituye al antiguo desplegable "+ Desde artículo". Aplica a
    presupuestos, pedidos, albaranes, facturas y órdenes. Verificado por captura.
  · Enlace CONFIRMAR/CANCELAR cita en recordatorios: cada cita tiene token; email/whatsapp incluyen
    {enlace} = {app_url}/cita/{token}. Página pública ConfirmarCita.jsx (ruta /cita/:token fuera del
    gate) muestra la cita y botones Confirmar/Cancelar. Backend: GET /api/public/cita/{token} y
    POST /api/public/cita/{token}/responder (accion=confirmar|cancelar → estado confirmada/cancelada).
    app_url se guarda en ajustes (lo envía el frontend en save + al enviar recordatorio) para que el
    scheduler construya el enlace. Verificado E2E por captura (estado pasa a 'confirmada').
- TALLER — CORTESÍAS VENCIDAS EN ROJO + RECORDATORIOS DE CITAS (2026-07-08):
  · UI: coches de cortesía vencidos (fecha_devolucion_prevista < hoy y no devueltos) se resaltan en ROJO
    con badge "Vencida" en TallerDashboard.jsx y en la lista de Cortesia.jsx. Verificado por screenshot.
  · Recordatorios de citas configurables desde Ajustes → sección "Notificaciones y recordatorios":
    Email (Resend) + WhatsApp (Twilio), credenciales guardadas POR TENANT en mongo (ajustes.notificaciones),
    NO en .env. Secretos (email.api_key, whatsapp.auth_token) enmascarados en GET ('••••••••' + *_set bool)
    y preservados en PUT si llega la máscara. Plantillas editables con variables {cliente}{empresa}{fecha}
    {hora}{matricula}{motivo}. Envío MANUAL (botón avión en cada cita, Citas.jsx) + AUTOMÁTICO
    (APScheduler cada 30 min, envía citas dentro de la ventana horas_antes, marca recordatorio_auto_at).
  · Backend: GET/PUT /api/ajustes (notificaciones), POST /api/taller/citas/{id}/recordatorio,
    POST /api/notificaciones/test. Helpers _enviar_email/_enviar_whatsapp/_enviar_recordatorio_cita,
    _job_recordatorios + AsyncIOScheduler en startup. Deps nuevas: resend, twilio, apscheduler.
  · Verificado testing_agent iteration_15 (backend 8/8: enmascarado, preservación, error-paths, 404, scheduler ok).
    Envío real no verificable sin claves de proveedor; probados los caminos de "no configurado" (sin 500).
    NOTA: el usuario aún NO tiene claves de Resend/Twilio; las introducirá en Ajustes cuando las obtenga.
- CITAS — AGENDA SEMANA/MES + IMPORTACIÓN CLIENTES EXCEL (2026-07-08):
  · Citas.jsx: vistas Agenda (lista) / Semana / Mes con navegación (Hoy, ‹ ›). El calendario
    fusiona citas (color por estado), PERITAJES pendientes (ámbar) y DEVOLUCIONES de cortesía
    (verde). Clic en día vacío = nueva cita; clic en cita = editar; peritaje/cortesía = a su sección.
    Reutiliza getPeritajes/getPrestamos; sin cambios de backend.
  · Importación de clientes por Excel: POST /api/contactos/importar (openpyxl, cabeceras flexibles)
    y GET /api/contactos/plantilla-excel (plantilla .xlsx). Botón "Importar Excel" + plantilla en
    Contactos.jsx. Dependencia nueva: openpyxl (en requirements.txt).
  · Verificado por curl + screenshots. NOTA: datos reales del usuario presentes (vehículo 7765HGJ).
- TALLER — HISTORIAL DE VEHÍCULO + PRESUPUESTOS VINCULADOS (2026-07-08):
  · Presupuestos de venta admiten vehiculo_id (selector "Vehículo" también en presupuestos;
    Documentos.jsx abre el formulario con el vehículo preseleccionado vía ?vehiculo=ID).
  · ficha_vehiculo agrega presupuestos, prestamos y citas además de ordenes/peritajes/compras.
  · Ficha del vehículo con pestañas "Resumen" / "Historial": el Historial es una LÍNEA DE TIEMPO
    cronológica (presupuestos, órdenes, peritajes, citas, compras y cortesías) con importe.
    Botón "Nuevo presupuesto" en la ficha → /ventas/presupuestos?vehiculo=ID.
  · Verificado por curl + screenshot. NOTA: hay datos REALES del usuario (vehículo 7765HGJ) —
    no borrar. Persisten presupuestos TEST de iteraciones antiguas (A-2026-0001..0004).
- TALLER — PANEL/DASHBOARD (2026-07-08):
  · Endpoint GET /api/taller/resumen (KPIs: total vehículos, órdenes abiertas y por estado,
    peritajes pendientes, cortesías activas, citas de hoy/próximas, últimas órdenes).
  · Frontend TallerDashboard.jsx en ruta /taller (primer icono "Panel" del ribbon de Taller).
    KPIs con enlaces, tablero de órdenes por estado, citas de hoy, últimas órdenes, cortesías.
  · Verificado por curl + screenshot (read-only). Módulo Taller: Panel + Fases 1-4 COMPLETO.
- MÓDULO TALLER — FASE 4 + INFORMES (2026-07-08):
  · Imputación de costes: pedidos/albaranes de COMPRA y facturas recibidas admiten vehiculo_id +
    vehiculo_matricula (DocumentoInput, FacturaRecibidaInput). Ficha de vehículo agrega compras[]
    y coste_compras (suma con IVA). Selector "Vehículo (imputar coste)" en formularios de compra
    (Documentos.jsx doc-vehiculo, FacturasRecibidas.jsx fr-vehiculo) — NO aparece en venta.
  · Informes imprimibles: lib/taller_print.js con imprimirParteOrden (parte de trabajo por orden,
    con fotos y firmas) e imprimirInformePeritaje (informe con daños valorados + reportaje
    fotográfico). Botones en filas de Órdenes y Peritajes.
  · Verificado testing_agent iteration_14 (backend 7/7, frontend 100%). MÓDULO TALLER COMPLETO (F1-F4).
  · Deuda técnica: server.py ~2.190 líneas → conviene split por dominio (documentos/taller/facturas).
- MÓDULO TALLER — FASE 3 (Citas + Vehículos de cortesía) (2026-07-08):
  · Backend: colecciones `citas` y `prestamos`. Endpoints /api/taller/citas (+ PATCH estado,
    filtros) y /api/taller/prestamos (+ POST /{id}/contrato img/PDF). Herencia matrícula/cliente.
  · Frontend: Citas.jsx (agenda por día, estados) y Cortesia.jsx (préstamos veh. cortesía + contrato).
    Nuevo icono "Cortesía" en ribbon Taller (5 items). Alta rápida veh/cliente en ambos.
  · Verificado testing_agent iteration_13 (backend 17/17, frontend E2E OK).
- MÓDULO TALLER — FASE 2 (Peritajes + Compañías + Fotos QR) (2026-07-08):
  · Backend: `peritajes`, `companias`, fotos. Endpoints /api/taller/peritajes, /api/taller/companias,
    /api/taller/{tipo}/{id}/fotos, /api/taller/media/{path}, /api/taller/foto-sesion + /subida/{token}
    (públicos, subida por QR desde móvil). Ficha vehículo devuelve {vehiculo, ordenes, peritajes}.
  · Frontend: Peritajes.jsx (daños valorados, compañías, reportaje fotográfico), FotosGaleria.jsx
    (subida directa + QR), SubirFotos.jsx (página pública /subir/:token fuera del gate), galería
    en ficha de vehículo (anexos). Alta rápida veh/cliente en Órdenes y Peritajes.
  · Verificado testing_agent iteration_12 (backend 100%, frontend 100%).
- MÓDULO TALLER — FASE 1 (Vehículos + Órdenes de trabajo) (2026-07-08):
  · Backend: colecciones `vehiculos` y `ordenes_trabajo`. Endpoints CRUD
    /api/taller/vehiculos (+ /{id}/ficha) y /api/taller/ordenes (+ PATCH /{id}/estado).
    Matrícula se guarda en MAYÚSCULAS; cliente_nombre se rellena desde contactos; la orden
    hereda vehículo/cliente y autonumera OT-000001 (_next_seq); totales vía calcular_lineas.
  · Frontend: pages Vehiculos.jsx (lista + alta/edición + ficha con órdenes) y OrdenesTrabajo.jsx
    (lista + alta/edición con LineasEditor, tipos chapa/pintura/mecánica, estados
    recepción→en curso→finalizado→entregado). lib/taller.jsx (EstadoOTBadge, TIPOS/ESTADOS).
    Clientes reutilizan contactos existentes (confirmado por usuario).
  · Verificado testing_agent iteration_11 (backend 14/14, frontend 100%). Aviso menor no
    bloqueante: warning React <span> en <option> (sin impacto).
  · PENDIENTE Taller: Fase 2 (peritajes + compañías de seguros + fotos por QR/subida móvil +
    anexar peritaciones email/whatsapp), Fase 3 (citas + vehículos de cortesía),
    Fase 4 (compras imputadas por vehículo).
- NAVEGACIÓN SUPERIOR + MÓDULO TALLER (scaffold) (2026-07-08):
  · Layout.jsx rediseñado: se sustituyó el sidebar izquierdo por una BARRA SUPERIOR estilo ribbon
    (referencia del usuario: Visionwin Gestión). Fila 1 = marca + pestañas de módulo
    (Panel, Ventas, Compras, Taller, Ajustes); Fila 2 = ribbon de iconos del módulo activo.
    main pasó de ml-64 a pt-[7.25rem]. Se QUITÓ el título "Panel de control" del Dashboard.
  · Nuevo módulo sectorial "Taller" con iconos: Vehículos, Órdenes de trabajo, Peritajes, Citas.
    Páginas provisionales (TallerPlaceholder.jsx) a la espera del FORMATO de formulario del usuario.
  · Rutas nuevas: /taller/vehiculos, /taller/ordenes, /taller/peritajes, /taller/citas.
  · CONFIRMADO usuario: fotos vía QR + subida web desde móvil; clientes = reutilizar contactos.
  · PENDIENTE: Fase 1 Taller (Vehículos CRUD + ficha, Órdenes de trabajo) tras recibir el formato.
- GESTIÓN DOCUMENTAL + BANCO PROVEEDOR (2026-07-08):
  · Datos bancarios (IBAN/Banco/BIC-SWIFT) ahora también en la ficha de PROVEEDOR (antes solo clientes).
  · Object storage (emergent): helpers init_storage/storage_put/storage_get/_guardar_pdf; POST /api/archivos/subir
    (PDF, máx 15MB) y GET /api/archivos/{path} (inline application/pdf). extraer_pdf guarda el PDF original y
    devuelve pdf_path/pdf_filename. DocumentoInput y FacturaRecibidaInput tienen pdf_path/pdf_filename.
  · Frontend: componente PdfPreview (iframe). Adjuntar PDF + "Vista previa" en Facturas Recibidas y en
    documentos de COMPRA (albaranes/pedidos recibidos). Los PDF importados por IA se guardan automáticamente.
  Verificado testing_agent iteration_10 (backend 6/6, frontend 100%).
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

## Estado / Bloqueos
- FACTURAE 3.2.2 (B2G/FACe) — FASE 1 + FIX PROVEEDOR + DIR3 (2026-07-08):
  · FIX: al crear factura recibida (y en docs de compra y en conversión albarán→factura recibida) ahora se
    da de alta el proveedor automáticamente (ensure_proveedor, dedup por NIF/nombre).
  · Ficha de Cliente: apartado "Administración Pública" (es_publica + DIR3: oficina_contable, organo_gestor,
    unidad_tramitadora). Campos en Contacto/ContactoInput.
  · Facturae 3.2.2: GET /api/facturas-emitidas/{id}/facturae devuelve XML descargable bien formado
    (_facturae_xml), con datos de empresa (Ajustes) + NIFs emisor/receptor + 3 AdministrativeCentre
    (roles 01/02/03) para clientes públicos + totales por tipo de IVA. Botón de descarga en cada factura emitida.
    Fase 1 = XML sin firmar (el usuario lo firma/sube a FACe). Fase 2 (firma XAdES-EPES + envío FACe) PENDIENTE
    (requiere certificado .p12 del usuario).
  Verificado testing_agent iteration_9 (backend 4/4, frontend 100%).

## Backlog / Próximos pasos (P1/P2)
- (P1) GESTIÓN DOCUMENTAL: adjuntar y visualizar el PDF original en facturas recibidas y albaranes recibidos
  (recomendado: object storage). PENDIENTE — acordado con el usuario.
- (P2) Facturae Fase 2: firma digital XAdES-EPES + envío automático a FACe (requiere certificado .p12).
- (P2) Añadir DialogDescription a los diálogos (avisos a11y recurrentes).
- (P1) Flujo enlazado: presupuesto → pedido → albarán → factura (venta) y pedido → albarán → factura (compra).
- Convertir pedido→albarán→factura (flujo enlazado).
- Conexión real a Verifactu/AEAT (certificado digital, entorno producción).
- Exportar factura a PDF y envío por email (Resend/SendGrid).
- Autenticación multiusuario y roles.
- Adjuntar/visualizar el PDF original en la ficha de factura recibida.
- Recepción automática de PDFs por email del proveedor (buzón de entrada).
