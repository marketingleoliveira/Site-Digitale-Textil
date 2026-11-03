import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
  created_at: string;
  category: { name: string; slug: string } | null;
}

export function BlogPreview() {
  const { t, language } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image, published_at, created_at, category:blog_categories(name, slug)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3);

    setPosts(data || []);
    setLoading(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const localeMap: Record<string, string> = { pt: "pt-BR", es: "es-ES", en: "en-US" };
    return new Date(dateString).toLocaleDateString(localeMap[language], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16"
        >
          <div className="text-center md:text-left">
            <span className="section-subtitle">{t("blog.label")}</span>
            <h2 className="section-title mt-3 md:mt-4">{t("blog.title")}</h2>
          </div>
          
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden">
                <Skeleton className="h-40 md:h-56 w-full" />
                <div className="p-4 md:p-6 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {posts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative"
              >
                <Link to={`/blog/${post.slug}`} className="block h-full">
                  {/* Main Card */}
                  <div className="relative bg-card rounded-xl overflow-hidden h-full shadow-md transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-accent/20 group-hover:-translate-y-2">
                    {/* Image Container */}
                    <div className="relative h-40 md:h-56 overflow-hidden bg-muted">
                      {post.featured_image ? (
                        <img
                          src={post.featured_image}
                          alt={post.title}
                          className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-75"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
                          <Tag className="h-8 w-8 md:h-10 md:w-10" />
                        </div>
                      )}
                      
                      {/* Category Badge */}
                      {post.category && (
                        <span className="absolute top-3 left-3 md:top-4 md:left-4 px-3 py-1 md:px-4 md:py-1.5 bg-accent text-white text-xs font-semibold rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110">
                          {post.category.name}
                        </span>
                      )}

                      {/* Overlay with Read More - Desktop Only */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:flex items-end justify-center pb-6">
                        <span className="flex items-center gap-2 text-white font-semibold px-6 py-2 bg-accent rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          {t("blog.readMore")}
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-6 relative">
                      {/* Decorative accent line */}
                      <div className="absolute top-0 left-4 right-4 md:left-6 md:right-6 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block" />
                      
                      <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-2 md:mb-3">
                        <Calendar className="h-3 w-3 md:h-4 md:w-4 text-accent" />
                        <span>{formatDate(post.published_at || post.created_at)}</span>
                      </div>
                      
                      <h3 className="text-base md:text-xl font-bold text-foreground mb-2 md:mb-3 group-hover:text-accent transition-colors duration-300 line-clamp-2">
                        {post.title}
                      </h3>
                      
                      {post.excerpt && (
                        <p className="text-muted-foreground text-xs md:text-sm line-clamp-2 group-hover:line-clamp-3 transition-all duration-300 hidden md:block">
                          {post.excerpt}
                        </p>
                      )}

                      {/* Arrow indicator - Desktop Only */}
                      <div className="hidden md:flex mt-4 items-center gap-2 text-accent font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                        <span className="text-sm">Continuar lendo</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">{t("blog.noResults")}</p>
            
          </div>
        )}
      </div>
    </section>
  );
}
