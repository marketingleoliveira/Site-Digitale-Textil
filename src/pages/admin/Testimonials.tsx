import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  GripVertical, 
  Star, 
  Eye, 
  EyeOff,
  Upload,
  X,
  Save,
  RefreshCw,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useInvalidateCache } from "@/hooks/useInvalidateCache";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_company: string | null;
  author_photo_url: string | null;
  video_url: string | null;
  rating: number;
  years_partnership: string | null;
  is_active: boolean;
  display_order: number;
}

const emptyTestimonial: Omit<Testimonial, "id"> = {
  quote: "",
  author_name: "",
  author_company: "",
  author_photo_url: "",
  video_url: "",
  rating: 5,
  years_partnership: "",
  is_active: true,
  display_order: 0,
};

function SortableTestimonialRow({
  testimonial,
  onToggleActive,
  onEdit,
  onDelete,
  onOrderChange,
}: {
  testimonial: Testimonial;
  onToggleActive: (id: string, currentState: boolean) => void;
  onEdit: (t: Testimonial) => void;
  onDelete: (id: string) => void;
  onOrderChange: (id: string, newOrder: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: testimonial.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-xl p-5 ${!testimonial.is_active ? "opacity-60" : ""} ${isDragging ? "shadow-lg ring-2 ring-accent/40" : ""}`}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1 -m-1"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Ordem</Label>
          <Input
            type="number"
            min={1}
            defaultValue={testimonial.display_order}
            key={testimonial.display_order}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v !== testimonial.display_order) {
                onOrderChange(testimonial.id, v);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-16 h-9 text-center font-semibold"
          />
        </div>

        {/* Photo */}
        <div className="flex-shrink-0">
          {testimonial.author_photo_url ? (
            <img
              src={testimonial.author_photo_url}
              alt={testimonial.author_name}
              className="w-14 h-14 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {testimonial.author_name.charAt(0)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground">{testimonial.author_name}</h3>
            {testimonial.author_company && (
              <span className="text-muted-foreground text-sm">• {testimonial.author_company}</span>
            )}
            {testimonial.years_partnership && (
              <Badge variant="secondary" className="text-xs">
                {testimonial.years_partnership}
              </Badge>
            )}
          </div>

          <div className="flex gap-0.5 mb-2">
            {[...Array(testimonial.rating)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-accent text-accent" />
            ))}
          </div>

          <p className="text-muted-foreground text-sm line-clamp-2">
            "{testimonial.quote}"
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onToggleActive(testimonial.id, testimonial.is_active)}
          >
            {testimonial.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          <Button size="icon" variant="ghost" onClick={() => onEdit(testimonial)}>
            <Edit2 className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir depoimento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O depoimento será removido permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(testimonial.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

const Testimonials = () => {
  const { invalidateTestimonials } = useInvalidateCache();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Partial<Testimonial> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [reordering, setReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Query for testimonials
  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Testimonial[];
    },
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = testimonials.findIndex((t) => t.id === active.id);
    const newIndex = testimonials.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(testimonials, oldIndex, newIndex);
    setReordering(true);
    try {
      const updates = reordered.map((t, idx) =>
        supabase.from("testimonials").update({ display_order: idx }).eq("id", t.id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      invalidateTestimonials();
      toast.success("Ordem atualizada!");
    } catch (e: any) {
      toast.error("Erro ao reordenar: " + (e.message || ""));
    } finally {
      setReordering(false);
    }
  };

  const handleOrderChange = async (id: string, newOrder: number) => {
    const current = [...testimonials].sort((a, b) => a.display_order - b.display_order);
    const oldIndex = current.findIndex((t) => t.id === id);
    if (oldIndex < 0) return;
    const targetIndex = Math.max(0, Math.min(current.length - 1, newOrder - 1));
    const [moved] = current.splice(oldIndex, 1);
    current.splice(targetIndex, 0, moved);
    setReordering(true);
    try {
      const updates = current.map((t, idx) =>
        supabase.from("testimonials").update({ display_order: idx }).eq("id", t.id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      invalidateTestimonials();
      toast.success("Ordem atualizada!");
    } catch (e: any) {
      toast.error("Erro ao reordenar: " + (e.message || ""));
    } finally {
      setReordering(false);
    }
  };

  // Save mutation (create/update)
  const saveMutation = useMutation({
    mutationFn: async (testimonial: Partial<Testimonial>) => {
      if (testimonial.id) {
        // Update existing
        const { error } = await supabase
          .from("testimonials")
          .update({
            quote: testimonial.quote,
            author_name: testimonial.author_name,
            author_company: testimonial.author_company || null,
            author_photo_url: testimonial.author_photo_url,
            video_url: testimonial.video_url || null,
            rating: testimonial.rating,
            years_partnership: testimonial.years_partnership || null,
            is_active: testimonial.is_active,
          })
          .eq("id", testimonial.id);

        if (error) throw error;
      } else {
        // Create new
        const maxOrder = Math.max(...testimonials.map(t => t.display_order), 0);
        const { error } = await supabase
          .from("testimonials")
          .insert({
            quote: testimonial.quote,
            author_name: testimonial.author_name,
            author_company: testimonial.author_company || null,
            author_photo_url: testimonial.author_photo_url,
            video_url: testimonial.video_url || null,
            rating: testimonial.rating || 5,
            years_partnership: testimonial.years_partnership || null,
            is_active: testimonial.is_active ?? true,
            display_order: maxOrder + 1,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateTestimonials();
      toast.success(editingTestimonial?.id ? "Depoimento atualizado!" : "Depoimento criado!");
      setDialogOpen(false);
      setEditingTestimonial(null);
    },
    onError: (error) => {
      toast.error("Erro ao salvar depoimento: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("testimonials")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTestimonials();
      toast.success("Depoimento excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir depoimento");
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("testimonials")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      invalidateTestimonials();
      toast.success(isActive ? "Depoimento ocultado" : "Depoimento ativado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleSave = () => {
    if (!editingTestimonial?.quote || !editingTestimonial?.author_name) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    saveMutation.mutate(editingTestimonial);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleToggleActive = (id: string, currentState: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: currentState });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("testimonials")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("testimonials")
        .getPublicUrl(fileName);

      setEditingTestimonial(prev => prev ? { ...prev, author_photo_url: publicUrl } : null);
      toast.success("Foto enviada!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Apenas vídeos são permitidos");
      return;
    }
    // Upload permitido independente do tamanho do arquivo

    setUploadingVideo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `video-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("testimonials")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("testimonials")
        .getPublicUrl(fileName);

      setEditingTestimonial(prev => prev ? { ...prev, video_url: publicUrl } : null);
      toast.success("Vídeo enviado!");
    } catch (error: any) {

      console.error(
        "Erro no upload do vídeo:",
        error
      );

      const message =
        error?.message
        ||
        error?.error?.message
        ||
        "Não foi possível enviar o vídeo";

      toast.error(
        "Erro ao enviar vídeo: "
        +
        message
      );

    } finally {

      setUploadingVideo(
        false
      );

      /*
       * Permite selecionar novamente
       * o mesmo arquivo após um erro.
       */
      e.target.value = "";
    }
  };

  const openCreateDialog = () => {
    setEditingTestimonial({ ...emptyTestimonial });
    setDialogOpen(true);
  };

  const openEditDialog = (testimonial: Testimonial) => {
    setEditingTestimonial({ ...testimonial });
    setDialogOpen(true);
  };

  return (
    <AdminLayout title="Depoimentos">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
              Gerencie os depoimentos exibidos na página inicial
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Depoimento
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : testimonials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum depoimento cadastrado. Clique em "Novo Depoimento" para adicionar.
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground -mt-2">
              {reordering ? "Salvando nova ordem..." : "Arraste pelo ícone à esquerda para reordenar."}
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={testimonials.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-4">
                  {testimonials.map((testimonial) => (
                    <SortableTestimonialRow
                      key={testimonial.id}
                      testimonial={testimonial}
                      onToggleActive={handleToggleActive}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      onOrderChange={handleOrderChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTestimonial?.id ? "Editar Depoimento" : "Novo Depoimento"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Photo Upload */}
              <div className="flex items-center gap-4">
                {editingTestimonial?.author_photo_url ? (
                  <div className="relative">
                    <img
                      src={editingTestimonial.author_photo_url}
                      alt="Preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-border"
                    />
                    <button
                      onClick={() => setEditingTestimonial(prev => prev ? { ...prev, author_photo_url: "" } : null)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border hover:border-accent transition-colors">
                      {uploading ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
                <div>
                  <p className="text-sm font-medium">Foto (opcional)</p>
                  <p className="text-xs text-muted-foreground">Clique para enviar</p>
                </div>
              </div>

              {/* Video Upload */}
              <div className="space-y-2">
                <Label>Vídeo do depoimento (opcional)</Label>
                {editingTestimonial?.video_url ? (
                  <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
                    <video
                      src={editingTestimonial.video_url}
                      controls
                      className="w-full max-h-64 object-contain bg-black"
                    />
                    <button
                      onClick={() => setEditingTestimonial(prev => prev ? { ...prev, video_url: "" } : null)}
                      className="absolute top-2 right-2 w-7 h-7 bg-destructive rounded-full flex items-center justify-center"
                      type="button"
                    >
                      <X className="w-4 h-4 text-destructive-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-accent transition-colors">
                      {uploadingVideo ? (
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Clique para enviar vídeo (MP4, WebM, MOV — até 1 GB)</span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      onChange={handleVideoUpload}
                      className="hidden"
                      disabled={uploadingVideo}
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="author_name">Nome *</Label>
                  <Input
                    id="author_name"
                    value={editingTestimonial?.author_name || ""}
                    onChange={(e) => setEditingTestimonial(prev => prev ? { ...prev, author_name: e.target.value } : null)}
                    placeholder="Nome do autor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author_company">Empresa</Label>
                  <Input
                    id="author_company"
                    value={editingTestimonial?.author_company || ""}
                    onChange={(e) => setEditingTestimonial(prev => prev ? { ...prev, author_company: e.target.value } : null)}
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote">Depoimento *</Label>
                <Textarea
                  id="quote"
                  value={editingTestimonial?.quote || ""}
                  onChange={(e) => setEditingTestimonial(prev => prev ? { ...prev, quote: e.target.value } : null)}
                  placeholder="O que o cliente disse..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating">Avaliação</Label>
                  <Select
                    value={String(editingTestimonial?.rating || 5)}
                    onValueChange={(value) => setEditingTestimonial(prev => prev ? { ...prev, rating: parseInt(value) } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r} estrela{r > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="years_partnership">Tempo de parceria</Label>
                  <Input
                    id="years_partnership"
                    value={editingTestimonial?.years_partnership || ""}
                    onChange={(e) => setEditingTestimonial(prev => prev ? { ...prev, years_partnership: e.target.value } : null)}
                    placeholder="Ex: 5 anos de parceria"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Testimonials;
