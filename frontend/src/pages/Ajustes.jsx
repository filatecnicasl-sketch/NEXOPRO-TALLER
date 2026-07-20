import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash, FloppyDisk, Buildings, Stack, Star, UploadSimple, Image as ImageIcon, BellRinging, EnvelopeSimple, WhatsappLogo, PaperPlaneTilt, House, Wrench, Printer, CaretRight, Certificate, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getAjustes, updateAjustes, probarNotificacion, getFormatos, subirCertificadoFacturae, guardarConfigFacturae, eliminarCertificadoFacturae } from "@/lib/api";
import { useAppAuth } from "@/lib/appAuth";
import { UsersThree } from "@phosphor-icons/react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const EMPRESA_FIELDS = [
  { k: "nombre", label: "Nombre / Razón social", span: 2 },
  { k: "nif", label: "NIF / CIF", mono: true },
  { k: "telefono", label: "Teléfono" },
  { k: "direccion", label: "Dirección", span: 2 },
  { k: "codigo_postal", label: "Código postal" },
  { k: "ciudad", label: "Ciudad" },
  { k: "email", label: "Email", span: 2 },
  { k: "iban", label: "IBAN", mono: true, span: 2 },
];

const emptySerie = (tipos) => ({
  id: "", nombre: "", por_defecto: false,
  contadores: tipos.reduce((a, t) => ({ ...a, [t]: 1 }), {}),
});

function SeriesEditor({ titulo, subtitulo, tipos, labels, series, setSeries }) {
  const cols = `1.4fr ${tipos.map(() => "1fr").join(" ")} 0.7fr 0.5fr`;
  const setField = (i, field, value) => {
    const next = [...series];
    next[i] = { ...next[i], [field]: value };
    setSeries(next);
  };
  const setContador = (i, tipo, value) => {
    const next = [...series];
    next[i] = { ...next[i], contadores: { ...next[i].contadores, [tipo]: value } };
    setSeries(next);
  };
  const setDefault = (i) => setSeries(series.map((s, idx) => ({ ...s, por_defecto: idx === i })));
  const remove = (i) => setSeries(series.filter((_, idx) => idx !== i));
  const add = () => setSeries([...series, emptySerie(tipos)]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><Stack size={18} weight="duotone" /></span>
        <div>
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900">{titulo}</h3>
          <p className="text-xs text-zinc-500">{subtitulo}</p>
        </div>
      </div>
      <div className="p-5 space-y-2">
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem" }} className="px-1 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
          <div>Serie</div>
          {tipos.map((t) => <div key={t} className="text-right">Próx. {labels[t]}</div>)}
          <div className="text-center">Defecto</div>
          <div />
        </div>
        {series.length === 0 && <p className="text-sm text-zinc-400 py-3 text-center">Sin series. Añade la primera.</p>}
        {series.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem" }} className="items-center" data-testid={`serie-row-${titulo}-${i}`}>
            <Input data-testid={`serie-nombre-${i}`} value={s.nombre} onChange={(e) => setField(i, "nombre", e.target.value.toUpperCase())} placeholder="Ej. A" className="h-9 rounded-md font-mono-plex text-sm" />
            {tipos.map((t) => (
              <Input key={t} type="number" min={1} value={s.contadores?.[t] ?? 1} onChange={(e) => setContador(i, t, e.target.value)} className="h-9 rounded-md text-sm text-right" />
            ))}
            <div className="flex justify-center">
              <button type="button" data-testid={`serie-default-${i}`} onClick={() => setDefault(i)} title="Marcar como serie por defecto"
                className={s.por_defecto ? "text-amber-500" : "text-zinc-300 hover:text-amber-400"}>
                <Star size={20} weight={s.por_defecto ? "fill" : "regular"} />
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" data-testid={`serie-delete-${i}`} onClick={() => remove(i)} className="text-zinc-400 hover:text-red-500 p-1"><Trash size={16} /></button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} className="rounded-md mt-2" data-testid={`add-serie-${titulo}`}>
          <Plus size={15} className="mr-1" /> Añadir serie
        </Button>
      </div>
    </div>
  );
}

function NotifEditor({ notif, setNotif }) {
  const [testEmail, setTestEmail] = useState("");
  const [testTel, setTestTel] = useState("");
  const [testing, setTesting] = useState("");
  const n = notif || {};
  const email = n.email || {}, wa = n.whatsapp || {}, rec = n.recordatorios || {};
  const setSec = (sec, campo, valor) => setNotif({ ...n, [sec]: { ...(n[sec] || {}), [campo]: valor } });

  const probar = async (canal, destino) => {
    if (!destino.trim()) return toast.error("Indica un destino de prueba");
    setTesting(canal);
    try {
      await probarNotificacion(canal, destino.trim());
      toast.success(canal === "email" ? "Email de prueba enviado" : "WhatsApp de prueba enviado");
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al enviar la prueba"); }
    finally { setTesting(""); }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="notif-card">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><BellRinging size={18} weight="duotone" /></span>
        <div>
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Notificaciones y recordatorios</h3>
          <p className="text-xs text-zinc-500">Configura el envío de recordatorios de citas por email y/o WhatsApp</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* EMAIL */}
        <div className="rounded-lg border border-zinc-150 border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800"><EnvelopeSimple size={18} className="text-indigo-500" /> Correo electrónico (Resend)</div>
            <Switch data-testid="notif-email-activo" checked={!!email.activo} onCheckedChange={(v) => setSec("email", "activo", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Email remitente (verificado en Resend)</Label><Input data-testid="notif-email-from" value={email.from_email || ""} onChange={(e) => setSec("email", "from_email", e.target.value)} placeholder="citas@tudominio.com" className="rounded-md mt-1" /></div>
            <div><Label className="text-xs">Nombre del remitente</Label><Input value={email.from_nombre || ""} onChange={(e) => setSec("email", "from_nombre", e.target.value)} placeholder="Taller Pérez" className="rounded-md mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">API Key de Resend {email.api_key_set && <span className="text-emerald-600">· configurada</span>}</Label><Input data-testid="notif-email-key" type="password" value={email.api_key || ""} onChange={(e) => setSec("email", "api_key", e.target.value)} placeholder="re_xxxxxxxx" className="rounded-md mt-1 font-mono-plex" /></div>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">Consigue tu clave gratis en resend.com → API Keys. Guarda antes de probar.</p>
          <div className="flex items-center gap-2 mt-3">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="tu@email.com" className="h-9 rounded-md text-sm max-w-xs" data-testid="notif-test-email-dest" />
            <Button type="button" variant="outline" size="sm" disabled={testing === "email"} onClick={() => probar("email", testEmail)} className="rounded-md" data-testid="notif-test-email"><PaperPlaneTilt size={14} className="mr-1" /> {testing === "email" ? "Enviando…" : "Enviar prueba"}</Button>
          </div>
        </div>

        {/* WHATSAPP */}
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800"><WhatsappLogo size={18} className="text-emerald-500" /> WhatsApp (Twilio)</div>
            <Switch data-testid="notif-wa-activo" checked={!!wa.activo} onCheckedChange={(v) => setSec("whatsapp", "activo", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Account SID</Label><Input data-testid="notif-wa-sid" value={wa.account_sid || ""} onChange={(e) => setSec("whatsapp", "account_sid", e.target.value)} placeholder="ACxxxxxxxx" className="rounded-md mt-1 font-mono-plex" /></div>
            <div><Label className="text-xs">Número WhatsApp (from)</Label><Input data-testid="notif-wa-from" value={wa.from_number || ""} onChange={(e) => setSec("whatsapp", "from_number", e.target.value)} placeholder="+14155238886" className="rounded-md mt-1 font-mono-plex" /></div>
            <div className="col-span-2"><Label className="text-xs">Auth Token {wa.auth_token_set && <span className="text-emerald-600">· configurado</span>}</Label><Input data-testid="notif-wa-token" type="password" value={wa.auth_token || ""} onChange={(e) => setSec("whatsapp", "auth_token", e.target.value)} placeholder="••••••••" className="rounded-md mt-1 font-mono-plex" /></div>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">Credenciales en console.twilio.com. El número debe tener WhatsApp habilitado. Guarda antes de probar.</p>
          <div className="flex items-center gap-2 mt-3">
            <Input value={testTel} onChange={(e) => setTestTel(e.target.value)} placeholder="+34600000000" className="h-9 rounded-md text-sm max-w-xs font-mono-plex" data-testid="notif-test-wa-dest" />
            <Button type="button" variant="outline" size="sm" disabled={testing === "whatsapp"} onClick={() => probar("whatsapp", testTel)} className="rounded-md" data-testid="notif-test-wa"><PaperPlaneTilt size={14} className="mr-1" /> {testing === "whatsapp" ? "Enviando…" : "Enviar prueba"}</Button>
          </div>
        </div>

        {/* RECORDATORIOS */}
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800"><BellRinging size={18} className="text-amber-500" /> Recordatorios automáticos de citas</div>
            <Switch data-testid="notif-rec-activo" checked={!!rec.activo} onCheckedChange={(v) => setSec("recordatorios", "activo", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Canal de envío</Label>
              <select data-testid="notif-rec-canal" value={rec.canal || "email"} onChange={(e) => setSec("recordatorios", "canal", e.target.value)} className="h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1">
                <option value="email">Solo Email</option>
                <option value="whatsapp">Solo WhatsApp</option>
                <option value="ambos">Email y WhatsApp</option>
              </select>
            </div>
            <div><Label className="text-xs">Enviar con antelación (horas)</Label><Input data-testid="notif-rec-horas" type="number" min={1} value={rec.horas_antes ?? 24} onChange={(e) => setSec("recordatorios", "horas_antes", Number(e.target.value))} className="rounded-md mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Asunto del email</Label><Input value={rec.email_asunto || ""} onChange={(e) => setSec("recordatorios", "email_asunto", e.target.value)} className="rounded-md mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Cuerpo del email</Label><Textarea value={rec.email_cuerpo || ""} onChange={(e) => setSec("recordatorios", "email_cuerpo", e.target.value)} rows={4} className="rounded-md mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Texto de WhatsApp</Label><Textarea value={rec.whatsapp_texto || ""} onChange={(e) => setSec("recordatorios", "whatsapp_texto", e.target.value)} rows={2} className="rounded-md mt-1" /></div>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">Variables disponibles: <span className="font-mono-plex">{"{cliente} {empresa} {fecha} {hora} {matricula} {motivo}"}</span></p>
        </div>
      </div>
    </div>
  );
}

function FacturaeCard({ fe, setFe }) {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const configurado = !!fe?.cert_configurado;

  const subir = async () => {
    if (!file) return toast.error("Selecciona el fichero del certificado (.p12 / .pfx)");
    if (!password) return toast.error("Introduce la contraseña del certificado");
    setBusy(true);
    try {
      const d = await subirCertificadoFacturae(file, password, fe?.entorno || "pruebas", fe?.proveedor_email || "");
      setFe(d.facturae || {});
      setFile(null); setPassword("");
      toast.success("Certificado subido y validado correctamente");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo validar el certificado"); }
    finally { setBusy(false); }
  };

  const guardarConfig = async () => {
    setBusy(true);
    try {
      const d = await guardarConfigFacturae(fe?.entorno || "pruebas", fe?.proveedor_email || "");
      setFe(d.facturae || {});
      toast.success("Configuración de FACe guardada");
    } catch { toast.error("Error al guardar la configuración"); }
    finally { setBusy(false); }
  };

  const eliminar = async () => {
    setBusy(true);
    try {
      const d = await eliminarCertificadoFacturae();
      setFe(d.facturae || {});
      toast.success("Certificado eliminado");
    } catch { toast.error("Error al eliminar el certificado"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="facturae-card">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"><Certificate size={18} weight="duotone" /></span>
        <div>
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Facturación electrónica (FACe)</h3>
          <p className="text-xs text-zinc-500">Certificado digital para firmar (XAdES-EPES) y enviar facturas a la Administración Pública</p>
        </div>
      </div>
      <div className="p-5 space-y-5">
        {configurado ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" data-testid="facturae-cert-estado">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck size={22} weight="fill" className="text-emerald-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-emerald-800">Certificado configurado</div>
                  <div className="text-emerald-700">{fe.cert_titular}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Válido: {fe.cert_valido_desde} → {fe.cert_valido_hasta}</div>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={eliminar} className="rounded-md border-red-200 text-red-600 hover:bg-red-50" data-testid="facturae-eliminar-cert">
                <Trash size={14} className="mr-1" /> Quitar
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 p-4 space-y-3" data-testid="facturae-cert-subir">
            <p className="text-sm text-zinc-600">Sube tu certificado digital (fichero <span className="font-mono-plex">.p12</span> o <span className="font-mono-plex">.pfx</span>) de representante o sello de empresa.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fichero del certificado</Label>
                <label className="mt-1 flex items-center gap-2 text-sm cursor-pointer border border-zinc-200 rounded-md px-3 py-2 hover:bg-zinc-50 transition-colors">
                  <UploadSimple size={16} /> {file ? file.name : "Seleccionar .p12 / .pfx"}
                  <input type="file" accept=".p12,.pfx" className="hidden" data-testid="facturae-file-input" onChange={(e) => setFile(e.target.files[0])} />
                </label>
              </div>
              <div>
                <Label className="text-xs">Contraseña del certificado</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-md mt-1 font-mono-plex" data-testid="facturae-password-input" />
              </div>
            </div>
            <Button type="button" disabled={busy} onClick={subir} className="rounded-md bg-emerald-600 hover:bg-emerald-700" data-testid="facturae-subir-cert">
              <UploadSimple size={15} className="mr-1.5" /> {busy ? "Validando…" : "Subir y validar certificado"}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Entorno de FACe</Label>
            <select data-testid="facturae-entorno" value={fe?.entorno || "pruebas"} onChange={(e) => setFe({ ...fe, entorno: e.target.value })} className="h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1">
              <option value="pruebas">Pruebas (staging)</option>
              <option value="produccion">Producción</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Email de contacto del proveedor</Label>
            <Input value={fe?.proveedor_email || ""} onChange={(e) => setFe({ ...fe, proveedor_email: e.target.value })} placeholder="facturacion@empresa.com" className="rounded-md mt-1" data-testid="facturae-email" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">Empieza en <b>Pruebas</b>. Tu certificado debe estar dado de alta en el Portal de Integradores de FACe.</p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={guardarConfig} className="rounded-md" data-testid="facturae-guardar-config"><FloppyDisk size={14} className="mr-1" /> Guardar</Button>
        </div>
      </div>
    </div>
  );
}


export default function Ajustes() {
  const { user } = useAppAuth();
  const [empresa, setEmpresa] = useState({});
  const [seriesVenta, setSeriesVenta] = useState([]);
  const [seriesCompra, setSeriesCompra] = useState([]);
  const [notif, setNotif] = useState(null);
  const [facturae, setFacturae] = useState({});
  const [moduloInicio, setModuloInicio] = useState("panel");
  const [formatos, setFormatos] = useState([]);
  const [formatoHojaEntrada, setFormatoHojaEntrada] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAjustes().then((d) => {
      setEmpresa(d.empresa || {});
      setSeriesVenta(d.series_venta || []);
      setSeriesCompra(d.series_compra || []);
      setNotif(d.notificaciones || null);
      setFacturae(d.facturae || {});
      setModuloInicio(d.modulo_inicio || "panel");
      setFormatoHojaEntrada(d.formato_hoja_entrada || "");
      setLoading(false);
    });
    getFormatos().then(setFormatos).catch(() => {});
  }, []);

  const save = async () => {
    const sv = seriesVenta.filter((s) => (s.nombre || "").trim());
    const sc = seriesCompra.filter((s) => (s.nombre || "").trim());
    setSaving(true);
    try {
      const d = await updateAjustes({ empresa, series_venta: sv, series_compra: sc, notificaciones: notif, modulo_inicio: moduloInicio, formato_hoja_entrada: formatoHojaEntrada || null, app_url: window.location.origin });
      setEmpresa(d.empresa || {});
      setSeriesVenta(d.series_venta || []);
      setSeriesCompra(d.series_compra || []);
      setNotif(d.notificaciones || null);
      setModuloInicio(d.modulo_inicio || "panel");
      setFormatoHojaEntrada(d.formato_hoja_entrada || "");
      // Reinicia la redirección de arranque para reflejar el cambio en la próxima carga
      try { sessionStorage.removeItem("inicio_done"); } catch (e) { /* noop */ }
      toast.success("Ajustes guardados");
    } catch { toast.error("Error al guardar ajustes"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-zinc-400">Cargando ajustes...</div>;

  const onLogo = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return toast.error("Sube una imagen PNG, JPG o WEBP");
    if (file.size > 600 * 1024) return toast.error("La imagen no debe superar 600 KB");
    const reader = new FileReader();
    reader.onload = () => setEmpresa((e) => ({ ...e, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-8 max-w-[1100px]" data-testid="ajustes-page">
      <PageHeader title="Ajustes" subtitle="Configura los datos de tu empresa y la numeración de series de compra y venta">
        <Button data-testid="guardar-ajustes-button" onClick={save} disabled={saving} className="rounded-md bg-primary hover:bg-indigo-700">
          <FloppyDisk size={16} className="mr-1.5" weight="fill" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><Buildings size={18} weight="duotone" /></span>
            <div>
              <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Datos de empresa</h3>
              <p className="text-xs text-zinc-500">Aparecerán en tus documentos y facturas</p>
            </div>
          </div>
          <div className="p-5 pt-5 flex items-center gap-4 border-b border-zinc-100">
            <div className="h-20 w-24 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden shrink-0" data-testid="empresa-logo-preview">
              {empresa.logo
                ? <img src={empresa.logo} alt="logo" className="max-h-full max-w-full object-contain" />
                : <ImageIcon size={26} className="text-zinc-300" />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer border border-zinc-200 rounded-md px-3 py-1.5 hover:bg-zinc-50 transition-colors">
                  <UploadSimple size={16} /> {empresa.logo ? "Cambiar logo" : "Subir logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="empresa-logo-input" onChange={(e) => onLogo(e.target.files[0])} />
                </label>
                {empresa.logo && (
                  <button data-testid="empresa-logo-remove" onClick={() => setEmpresa({ ...empresa, logo: "" })} className="text-xs text-red-500 hover:underline">Quitar</button>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">PNG, JPG o WEBP · máx 600 KB. Aparecerá en tus documentos.</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            {EMPRESA_FIELDS.map((f) => (
              <div key={f.k} className={f.span === 2 ? "col-span-2" : ""}>
                <Label className="text-xs">{f.label}</Label>
                <Input
                  data-testid={`empresa-${f.k}`}
                  value={empresa[f.k] || ""}
                  onChange={(e) => setEmpresa({ ...empresa, [f.k]: e.target.value })}
                  className={`rounded-md mt-1 ${f.mono ? "font-mono-plex" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>

        <SeriesEditor
          titulo="Series de venta"
          subtitulo="Numeración de presupuestos, pedidos, albaranes y facturas emitidas"
          tipos={["presupuestos", "pedidos", "albaranes", "facturas"]}
          labels={{ presupuestos: "Presup.", pedidos: "Pedido", albaranes: "Albarán", facturas: "Factura" }}
          series={seriesVenta}
          setSeries={setSeriesVenta}
        />

        <SeriesEditor
          titulo="Series de compra"
          subtitulo="Numeración interna de pedidos y albaranes recibidos"
          tipos={["pedidos", "albaranes"]}
          labels={{ pedidos: "Pedido", albaranes: "Albarán" }}
          series={seriesCompra}
          setSeries={setSeriesCompra}
        />

        <NotifEditor notif={notif} setNotif={setNotif} />

        {user?.role === "admin" && (
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="usuarios-card">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><UsersThree size={18} weight="duotone" /></span>
              <div>
                <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Usuarios y permisos</h3>
                <p className="text-xs text-zinc-500">Da de alta empleados (administrador, recepción, mecánico) y gestiona su acceso</p>
              </div>
            </div>
            <div className="p-5">
              <Link to="/usuarios" data-testid="abrir-usuarios">
                <Button className="rounded-md bg-primary hover:bg-indigo-700"><UsersThree size={16} className="mr-1.5" weight="bold" /> Gestionar usuarios <CaretRight size={16} className="ml-1.5" /></Button>
              </Link>
            </div>
          </div>
        )}

        <FacturaeCard fe={facturae} setFe={setFacturae} />

        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="modulo-inicio-card">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><House size={18} weight="duotone" /></span>
            <div>
              <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Módulo de inicio</h3>
              <p className="text-xs text-zinc-500">Elige qué pantalla se abre al entrar en la aplicación</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <button
              type="button"
              data-testid="modulo-inicio-panel"
              onClick={() => setModuloInicio("panel")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${moduloInicio === "panel" ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-zinc-200 hover:border-zinc-300"}`}
            >
              <House size={22} className={moduloInicio === "panel" ? "text-indigo-600" : "text-zinc-400"} weight="duotone" />
              <div>
                <div className="font-semibold text-sm text-zinc-900">Panel principal</div>
                <div className="text-xs text-zinc-500">Resumen del ERP (ventas, compras, facturas)</div>
              </div>
            </button>
            <button
              type="button"
              data-testid="modulo-inicio-taller"
              onClick={() => setModuloInicio("taller")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${moduloInicio === "taller" ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-zinc-200 hover:border-zinc-300"}`}
            >
              <Wrench size={22} className={moduloInicio === "taller" ? "text-indigo-600" : "text-zinc-400"} weight="duotone" />
              <div>
                <div className="font-semibold text-sm text-zinc-900">Taller</div>
                <div className="text-xs text-zinc-500">Panel de taller (órdenes, citas, vehículos)</div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="formatos-card">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600"><Printer size={18} weight="duotone" /></span>
            <div>
              <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Formatos de impresión</h3>
              <p className="text-xs text-zinc-500">Diseña tus propias plantillas (recepción de vehículo, resguardos…) y rellénalas para imprimir</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1.5">Plantilla para la "Hoja de entrada"</label>
              <select
                data-testid="select-formato-hoja-entrada"
                value={formatoHojaEntrada}
                onChange={(e) => setFormatoHojaEntrada(e.target.value)}
                className="w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Automático (usar "Recepción de Vehículo")</option>
                {formatos.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
              <p className="text-xs text-zinc-400 mt-1">Al imprimir la hoja de entrada de una orden/recepción se usará esta plantilla con los datos reales del vehículo.</p>
            </div>
            <Link to="/ajustes/formatos" data-testid="abrir-editor-formatos">
              <Button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                <Printer size={16} className="mr-1.5" weight="bold" /> Abrir editor de formatos
                <CaretRight size={16} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
