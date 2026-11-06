import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Eye, EyeOff, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface Category {
  id: string;
  name: string;
  slug: string;
}

const PostEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    obs: "",
    content: "",
    featured_image: "",
    category_id: "",
    status: "draft",
    meta_title: "",
    meta_description: "",
  });

  useEffect(() => {
    fetchCategories();
    if (!isNew && id) {
      fetchPost(id);
    }
  }, [id]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("blog_categories").select("id, name, slug").order("name");
    setCategories(data || []);
  };

  const fetchPost = async (postId: string) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();

    if (error || !data) {
      toast.error("Post não encontrado");
      navigate("/admin/posts");
    } else {
      setForm({
        title: data.title || "",
        slug: data.slug || "",
        excerpt: data.excerpt || "",
        obs: data.obs || "",
        content: data.content || "",
        featured_image: data.featured_image || "",
        category_id: data.category_id || "",
        status: data.status || "draft",
        meta_title: data.meta_title || "",
        meta_description: data.meta_description || "",
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: isNew ? generateSlug(title) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const postData = {
      ...form,
      category_id: form.category_id || null,
      author_id: user?.id,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };

    let error;

    if (isNew) {
      const result = await supabase.from("blog_posts").insert([postData]);
      error = result.error;
    } else {
      const result = await supabase.from("blog_posts").update(postData).eq("id", id);
      error = result.error;
    }

    if (error) {
      toast.error("Erro ao salvar post", { description: error.message });
    } else {
      toast.success(isNew ? "Post criado com sucesso!" : "Post atualizado!");
      navigate("/admin/posts");
    }

    setLoading(false);
  };

  return (
    <AdminLayout title={isNew ? "Novo Post" : "Editar Post"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button type="button" variant="ghost" onClick={() => navigate("/admin/posts")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1" />
          {!isNew && form.status === "published" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/blog/${form.slug}`, "_blank")}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título do post"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="url-do-post"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Resumo</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  placeholder="Breve descrição do post..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="editor" className="gap-2">
                      <Edit3 className="h-4 w-4" />
                      Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Pré-visualização
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="editor" className="mt-0">
                    <RichTextEditor
                      content={form.content}
                      onChange={(content) => setForm({ ...form, content })}
                      placeholder="Escreva o conteúdo do post..."
                    />
                  </TabsContent>
                  
                  <TabsContent value="preview" className="mt-0">
                    <div className="border border-border rounded-xl bg-background p-6 min-h-[400px]">
                      {form.content ? (
                        <article className="blog-content">
                          {form.title && (
                            <h1 className="text-3xl font-display font-bold text-foreground mb-4">
                              {form.title}
                            </h1>
                          )}
                          {form.excerpt && (
                            <p className="text-lg text-muted-foreground mb-6 pb-6 border-b border-border">
                              {form.excerpt}
                            </p>
                          )}
                          <div 
                            className="prose prose-lg max-w-none"
                            dangerouslySetInnerHTML={{ __html: form.content }} 
                          />
                        </article>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                          <div className="text-center">
                            <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum conteúdo para visualizar</p>
                            <p className="text-sm">Comece a escrever no editor</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-display font-semibold">SEO</h3>
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Título</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                  placeholder="Título para SEO (máx. 60 caracteres)"
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Descrição</Label>
                <Textarea
                  id="meta_description"
                  value={form.meta_description}
                  onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  placeholder="Descrição para SEO (máx. 160 caracteres)"
                  rows={2}
                  maxLength={160}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-display font-semibold">Publicação</h3>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(value) => setForm({ ...form, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="obs">OBS (Observações)</Label>
                <Textarea
                  id="obs"
                  value={form.obs}
                  onChange={(e) => setForm({ ...form, obs: e.target.value })}
                  placeholder="Observações sobre esta publicação..."
                  rows={4}
                  className="resize-y"
                />
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <h3 className="font-display font-semibold">Imagem Destacada</h3>
              <ImageUpload
                bucket="blog"
                folder="featured"
                value={form.featured_image}
                onChange={(url) => setForm({ ...form, featured_image: url })}
              />
            </div>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
};

export default PostEditor;
