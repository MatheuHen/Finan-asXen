"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Palette, Pencil, Plus, Tags, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { IconPicker } from "@/components/ui/icon-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useCategories, useCategoryUsage, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/hooks/financial/useCategories";
import type { Category, CategoryType } from "@/services/financial/categories.service";

function typeLabel(t: CategoryType) {
  return t === "income" ? "Receitas" : "Despesas";
}

const DEFAULT_CATEGORY_COLOR = "#94a3b8";

export default function CategoriesPage() {
  const categories = useCategories();
  const { mutate: createCategory, isPending: isCreating, error: createError } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdating, error: updateError } = useUpdateCategory();
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const categoryUsage = useCategoryUsage(deleting?.id);

  const list = useMemo(() => categories.data ?? [], [categories.data]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setType("expense");
    setColor(DEFAULT_CATEGORY_COLOR);
    setIcon("");
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name ?? "");
    setType(c.type);
    setColor((c.color ?? DEFAULT_CATEGORY_COLOR).toString());
    setIcon((c.icon ?? "").toString());
    setOpen(true);
  };

  const confirmDelete = (c: Category) => {
    setDeleting(c);
    setDeleteOpen(true);
  };

  const canSave = name.trim().length > 0 && !isCreating && !isUpdating;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">Você organiza suas movimentações para enxergar melhor seus gastos e seus gráficos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Nova categoria
        </Button>
      </div>

      {categories.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-3xl">
              <CardHeader>
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 size-12 rounded-2xl border bg-background/40 flex items-center justify-center">
              <Tags className="size-5 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium">Nenhuma categoria ainda</div>
            <div className="text-xs text-muted-foreground mt-1">Crie categorias para rastrear melhor seus gastos</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className="rounded-3xl">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  <div className="mt-1 text-xs text-muted-foreground">{typeLabel(c.type)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.color ? (
                    <div
                      className="size-9 rounded-2xl border bg-background/40"
                      style={{ backgroundColor: c.color }}
                      title={c.color ?? ""}
                    />
                  ) : (
                    <div className="size-9 rounded-2xl border bg-background/40 flex items-center justify-center">
                      <Palette className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{c.icon ? "Ícone: " + c.icon : "Sem ícone"}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => confirmDelete(c)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Você ajusta sua categoria" : "Você adiciona uma categoria"}</DialogTitle>
            <DialogDescription>Você usa categorias para organizar suas movimentações e enxergar melhor seus números</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Nome</div>
              <Input value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Ex: Alimentação" />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Tipo</div>
              <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left">{typeLabel(type)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Cor</div>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-4 rounded-full border border-black/5 dark:border-white/10"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                  </div>
                </div>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Ícone (opcional)</div>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
            </div>

            {(createError || updateError) && (
              <div className="text-sm text-destructive">Você não conseguiu salvar. Tente novamente.</div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating || isUpdating}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const n = name.trim();
                if (!n) return;
                const payload = {
                  name: n,
                  type,
                  color,
                  icon: icon.length > 0 ? icon : null,
                };
                if (editing) {
                  updateCategory(
                    { id: editing.id, ...payload },
                    {
                      onSuccess: () => setOpen(false),
                    }
                  );
                  return;
                }
                createCategory(payload, { onSuccess: () => setOpen(false) });
              }}
              disabled={!canSave}
            >
              {editing ? (isUpdating ? "Salvando..." : "Salvar") : isCreating ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover categoria</DialogTitle>
            <DialogDescription>
              {categoryUsage.data ? (
                <div className="mt-2 flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-rose-700 dark:text-rose-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    Você tem movimentações nesta categoria.
                    <br />
                    Se você continuar, essas movimentações vão ficar sem categoria.
                  </div>
                </div>
              ) : (
                "Você quer remover a categoria “" +
                (deleting?.name ?? "") +
                "”? Suas movimentações vão ficar sem categoria."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = deleting?.id;
                if (!id) return;
                deleteCategory(
                  { id, unlink: Boolean(categoryUsage.data) },
                  { onSuccess: () => setDeleteOpen(false) }
                );
              }}
              disabled={isDeleting || categoryUsage.isLoading}
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
