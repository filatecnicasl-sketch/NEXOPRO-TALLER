import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, MagnifyingGlass, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getContactos, createContacto, updateContacto, deleteContacto } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Initials from "@/components/Initials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY = { nombre: "", nif: "", email: "", telefono: "", direccion: "", ciudad: "", codigo_postal: "", pais: "España", iban: "", banco: "", swift: "", direccion_entrega: "", ciudad_entrega: "", cp_entrega: "", notas: "" };

export default function Contactos({ tipo }) {
  const label = tipo === "cliente" ? "Cliente" : "Proveedor";
  const plural = tipo === "cliente" ? "Clientes" : "Proveedores";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const load = () => {
    setLoading(true);
    getContactos(tipo).then((d) => { setItems(d); setLoading(false); });
  };
  useEffect(load, [tipo]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm(c); setEditId(c.id); setOpen(true); };

  const save = async () => {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    try {
      if (editId) {
        await updateContacto(editId, { ...form, tipo });
        toast.success(`${label} actualizado`);
      } else {
        await createContacto({ ...form, tipo });
        toast.success(`${label} creado`);
      }
      setOpen(false);
      load();
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async () => {
    await deleteContacto(delId);
    setDelId(null);
    toast.success(`${label} eliminado`);
    load();
  };

  const filtered = items.filter(
    (c) => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.nif || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1400px]" data-testid={`${tipo}-page`}>
      <PageHeader title={plural} subtitle={`Gestiona tu cartera de ${plural.toLowerCase()}`} chip={`${items.length} ${items.length === 1 ? "registro" : "registros"}`}>
        <Button data-testid="nuevo-contacto-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700">
          <Plus size={16} className="mr-1.5" /> Nuevo {label.toLowerCase()}
        </Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          data-testid="buscar-contacto-input"
          placeholder="Buscar por nombre o NIF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-md bg-white"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Nombre</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">NIF/CIF</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Teléfono</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Ciudad</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <UsersThree size={26} className="text-zinc-400" />
                  </div>
                  <p className="text-zinc-700 text-sm font-medium">No hay {plural.toLowerCase()} todavía</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Empieza añadiendo tu primer {label.toLowerCase()}.</p>
                  <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700">
                    <Plus size={15} className="mr-1.5" /> Nuevo {label.toLowerCase()}
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c, i) => (
              <TableRow key={c.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`contacto-row-${c.id}`}>
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-3">
                    <Initials name={c.nombre} />
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 truncate">{c.nombre}</div>
                      <div className="text-xs text-zinc-400 truncate">{c.email || "Sin email"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono-plex text-xs text-zinc-600">{c.nif || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-sm">{c.telefono || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-sm">{c.ciudad || "—"}</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-${c.id}`} onClick={() => openEdit(c)} className="text-zinc-400 hover:text-primary p-1.5 transition-colors">
                    <PencilSimple size={16} />
                  </button>
                  <button data-testid={`eliminar-${c.id}`} onClick={() => setDelId(c.id)} className="text-zinc-400 hover:text-red-500 p-1.5 transition-colors">
                    <Trash size={16} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm max-h-[90vh] overflow-y-auto" data-testid="contacto-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? `Editar ${label.toLowerCase()}` : `Nuevo ${label.toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Nombre / Razón social *</Label>
              <Input data-testid="input-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">NIF / CIF</Label>
              <Input data-testid="input-nif" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Email</Label>
              <Input data-testid="input-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ciudad</Label>
              <Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Código postal</Label>
              <Input value={form.codigo_postal} onChange={(e) => setForm({ ...form, codigo_postal: e.target.value })} className="rounded-sm mt-1" />
            </div>
            {tipo === "cliente" && (
              <>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Datos bancarios</div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">IBAN</Label>
                  <Input data-testid="input-iban" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="rounded-sm mt-1 font-mono-plex" placeholder="ES00 0000 0000 0000 0000 0000" />
                </div>
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="rounded-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">BIC / SWIFT</Label>
                  <Input value={form.swift} onChange={(e) => setForm({ ...form, swift: e.target.value })} className="rounded-sm mt-1 font-mono-plex" />
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Dirección de entrega</div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Dirección de entrega</Label>
                  <Input data-testid="input-direccion-entrega" value={form.direccion_entrega} onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })} className="rounded-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Ciudad entrega</Label>
                  <Input value={form.ciudad_entrega} onChange={(e) => setForm({ ...form, ciudad_entrega: e.target.value })} className="rounded-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">CP entrega</Label>
                  <Input value={form.cp_entrega} onChange={(e) => setForm({ ...form, cp_entrega: e.target.value })} className="rounded-sm mt-1" />
                </div>
              </>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-contacto-button" onClick={save} className="rounded-sm bg-primary">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-button" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
