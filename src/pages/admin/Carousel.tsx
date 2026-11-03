import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Upload, Image as ImageIcon } from "lucide-react";
import { useInvalidateCache } from "@/hooks/useInvalidateCache";

interface CarouselSlide {
  id: string;
  image_url: string;
  alt_text: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

// DIGITALE_CAROUSEL_WEBP_UPLOAD_V1
async function optimizeCarouselUpload(file: File): Promise<File> {
  if (file.type === "image/webp") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.9);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName =
      file.name.replace(/\.[^/.]+$/, "") || "carousel";

    return new File(
      [blob],
      `${baseName}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now(),
      },
    );
  } catch {
    return file;
  }
}

export default function Carousel() {
  const { invalidateCarousel } = useInvalidateCache();
  const [uploading, setUploading] = useState(false);

  const { data: slides, isLoading } = useQuery({
    queryKey: ["admin-carousel-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_slides")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as CarouselSlide[];
    },
  });

  const updateSlideMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarouselSlide> & { id: string }) => {
      const { error } = await supabase
        .from("carousel_slides")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCarousel();
    },
    onError: () => {
      toast.error("Erro ao atualizar slide");
    },
  });

  const deleteSlideMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("carousel_slides")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCarousel();
      toast.success("Slide removido");
    },
    onError: () => {
      toast.error("Erro ao remover slide");
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB");
      return;
    }

    setUploading(true);

    try {
      const uploadFile = await optimizeCarouselUpload(file);
      const fileExt = uploadFile.name.split(".").pop() || "webp";
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("carousel")
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("carousel")
        .getPublicUrl(fileName);

      // Get max display order
      const maxOrder = slides?.reduce((max, s) => Math.max(max, s.display_order), -1) ?? -1;

      // Insert new slide
      const { error: insertError } = await supabase
        .from("carousel_slides")
        .insert({
          image_url: publicUrl,
          alt_text: file.name.replace(/\.[^/.]+$/, ""),
          display_order: maxOrder + 1,
          is_active: true,
        });

      if (insertError) throw insertError;

      invalidateCarousel();
      toast.success("Imagem adicionada ao carrossel");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleToggleActive = (slide: CarouselSlide) => {
    updateSlideMutation.mutate({ id: slide.id, is_active: !slide.is_active });
  };

  const handleUpdateAltText = (id: string, alt_text: string) => {
    updateSlideMutation.mutate({ id, alt_text });
  };

  const handleUpdateLinkUrl = (id: string, link_url: string) => {
    updateSlideMutation.mutate({ id, link_url: link_url || null });
  };

  const handleUpdateOrder = (id: string, display_order: number) => {
    updateSlideMutation.mutate({ id, display_order });
  };

  return (
    <AdminLayout title="Carrossel">
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Tamanho recomendado:</strong> 1900x500 pixels para melhor qualidade.
            Imagens serão ajustadas automaticamente para caber no carrossel.
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex justify-end">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Imagem
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>

        {/* Slides List */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-32 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : slides?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma imagem no carrossel</h3>
              <p className="text-muted-foreground mb-4">
                Adicione imagens para exibir no carrossel da página inicial.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {slides?.map((slide) => (
              <Card key={slide.id} className={!slide.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Drag Handle */}
                    <div className="flex items-center text-muted-foreground cursor-move">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Image Preview */}
                    <div className="w-48 h-24 bg-muted rounded overflow-hidden flex-shrink-0">
                      <img
                        src={slide.image_url}
                        alt={slide.alt_text || "Slide"}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Settings */}
                    <div className="flex-1 grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`alt-${slide.id}`} className="text-xs">
                            Texto alternativo
                          </Label>
                          <Input
                            id={`alt-${slide.id}`}
                            value={slide.alt_text || ""}
                            onChange={(e) => handleUpdateAltText(slide.id, e.target.value)}
                            placeholder="Descrição da imagem"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`link-${slide.id}`} className="text-xs">
                            Link (opcional)
                          </Label>
                          <Input
                            id={`link-${slide.id}`}
                            value={slide.link_url || ""}
                            onChange={(e) => handleUpdateLinkUrl(slide.id, e.target.value)}
                            placeholder="/pagina ou https://..."
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <Label htmlFor={`order-${slide.id}`} className="text-xs">
                            Ordem
                          </Label>
                          <Input
                            id={`order-${slide.id}`}
                            type="number"
                            value={slide.display_order}
                            onChange={(e) => handleUpdateOrder(slide.id, parseInt(e.target.value) || 0)}
                            className="h-8 text-sm w-20"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={slide.is_active}
                            onCheckedChange={() => handleToggleActive(slide)}
                          />
                          <Label className="text-xs">Ativo</Label>
                        </div>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <div className="flex items-start">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Remover este slide?")) {
                            deleteSlideMutation.mutate(slide.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
