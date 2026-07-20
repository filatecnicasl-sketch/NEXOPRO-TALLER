import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, Key, ShieldCheck, User } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getAppUsuarios, createAppUsuario, updateAppUsuario, resetAppUsuarioPassword, deleteAppUsuario } from "@/lib/api";
import { useAppAuth } from "@/lib/appAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLES = [
  { v: "admin", l: "Administrador", c: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { v: "recepcion", l: "Recepción", c: "bg-amber-50 text-amber-700 ring-amber-200" },
  { v: "operario", l: "Mecánico / Operario", c: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
];
const roleInfo = (r) => ROLES.find((x) => x.v === r) || ROLES[2];
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";
const EMPTY = { nombre: "", email: "", password: "", role: "operario", activo: true };

export default function Usuarios() {
  const { user: yo } = useAppAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [nuevaPwd, setNuevaPwd] = useState("");

  const load = () => { setLoading(true); getAppUsuarios().then((d) => { setItems(d); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (u) => { setForm({ ...EMPTY, ...u, password: "" }); setEditId(u.id); setOpen(true); };

  const save = async () => {
    if (!form.email.trim()) return toast.error("El email es obligatorio");
    try {
      if (editId) { await updateAppUsuario(editId, { nombre: form.nombre, email: form.email, role: form.role, activo: form.activo }); toast.success("Usuario actualizado"); }
      else { await createAppUsuario(form); toast.success("Usuario creado. Deberá cambiar la contraseña al entrar."); }
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al guardar"); }
  };

  const remove = async () => {
    try { await deleteAppUsuario(delId); toast.success("Usuario eliminado"); setDelId(null); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo eliminar"); setDelId(null); }
  };

  const doReset = async () => {
    try { await resetAppUsuarioPassword(resetFor.id, nuevaPwd); toast.success("Contraseña restablecida"); setResetFor(null); setNuevaPwd(""); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo restablecer"); }
  };

  return (
    <div className="p-8 max-w-[1100px]" data-testid="usuarios-page">
      <PageHeader title="Usuarios" subtitle="Empleados con acceso al programa y sus permisos" chip={`${items.length} ${items.length === 1 ? "usuario" : "usuarios"}`}>
        <Button data-testid="nuevo-usuario-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700"><Plus size={16} className="mr-1.5" /> Nuevo usuario</Button>
      </PageHeader>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              {["Nombre", "Email", "Rol", "2FA", "Estado", "Acciones"].map((h, i) => (
                <TableHead key={h} className={`text-[11px] uppercase tracking-wider text-zinc-500 font-semibold ${i === 5 ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && items.map((u) => {
              const ri = roleInfo(u.role);
              return (
                <TableRow key={u.id} className="border-zinc-100 hover:bg-zinc-50/70" data-testid={`usuario-row-${u.id}`}>
                  <TableCell className="py-2.5 font-medium text-zinc-900 flex items-center gap-2"><User size={15} className="text-zinc-400" />{u.nombre || "—"}{u.id === yo?.id && <span className="text-[10px] text-indigo-500">(tú)</span>}</TableCell>
                  <TableCell className="text-zinc-600 text-sm font-mono-plex">{u.email}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ri.c}`}>{ri.l}</span></TableCell>
                  <TableCell>{u.totp_enabled ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><ShieldCheck size={13} weight="fill" /> Activo</span> : <span className="text-xs text-zinc-400">—</span>}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.activo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{u.activo ? "Activo" : "Desactivado"}</span></TableCell>
                  <TableCell className="text-right">
                    <button data-testid={`reset-usuario-${u.id}`} onClick={() => { setResetFor(u); setNuevaPwd(""); }} title="Restablecer contraseña" className="text-zinc-400 hover:text-amber-500 p-1.5"><Key size={16} /></button>
                    <button data-testid={`editar-usuario-${u.id}`} onClick={() => openEdit(u)} title="Editar" className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                    <button data-testid={`eliminar-usuario-${u.id}`} onClick={() => setDelId(u.id)} title="Eliminar" className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Alta / edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="usuario-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>{editId ? "Actualiza los datos y el rol del empleado." : "El usuario deberá cambiar su contraseña al iniciar sesión por primera vez."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label className="text-xs">Nombre</Label><Input data-testid="usuario-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">Email</Label><Input data-testid="usuario-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-sm mt-1 font-mono-plex" disabled={!!editId} /></div>
            {!editId && <div><Label className="text-xs">Contraseña inicial</Label><Input data-testid="usuario-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-sm mt-1 font-mono-plex" placeholder="Mín. 8, 1 mayúscula y 1 número" /></div>}
            <div><Label className="text-xs">Rol</Label>
              <select data-testid="usuario-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={selectCls}>
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            {editId && (
              <label className="flex items-center gap-2 text-sm text-zinc-700 pt-1">
                <input type="checkbox" data-testid="usuario-activo" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Cuenta activa
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-usuario-button" onClick={save} className="rounded-sm bg-primary">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset contraseña */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent className="sm:max-w-sm rounded-sm" data-testid="reset-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Restablecer contraseña</DialogTitle>
            <DialogDescription>Nueva contraseña para {resetFor?.email}. Deberá cambiarla al entrar.</DialogDescription>
          </DialogHeader>
          <Input data-testid="reset-nueva-password" type="text" value={nuevaPwd} onChange={(e) => setNuevaPwd(e.target.value)} className="rounded-sm font-mono-plex" placeholder="Mín. 8, 1 mayúscula y 1 número" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="confirmar-reset-button" onClick={doReset} className="rounded-sm bg-amber-600 hover:bg-amber-700">Restablecer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>Perderá el acceso al programa. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-usuario" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
