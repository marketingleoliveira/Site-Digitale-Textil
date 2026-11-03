import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import Index from "./pages/Index";

















import { WhatsAppButton } from "./components/chat/WhatsAppButton";





























import { NewsletterPopup } from "./components/newsletter/NewsletterPopup";
import { TrackingPixel } from "./components/tracking/TrackingPixel";
import { TrackingIdentityGate } from "./components/tracking/TrackingIdentityGate";

/* DIGITALE_ROUTE_LAZY_V1 */
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Fabrics = lazy(() => import("./pages/Fabrics"));
const FabricDetail = lazy(() => import("./pages/FabricDetail"));
const WholesaleLanding = lazy(() => import("./pages/WholesaleLanding"));
const Prints = lazy(() => import("./pages/Prints"));
const PrintsCatalog = lazy(() => import("./pages/PrintsCatalog"));
const Segments = lazy(() => import("./pages/Segments"));
const SegmentDetail = lazy(() => import("./pages/SegmentDetail"));
const Sustainability = lazy(() => import("./pages/Sustainability"));
const Technologies = lazy(() => import("./pages/Technologies"));
const TestimonialsPage = lazy(() => import("./pages/Testimonials"));
const Privacy = lazy(() => import("./pages/Privacy"));
const WorkWithUs = lazy(() => import("./pages/WorkWithUs"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Posts = lazy(() => import("./pages/admin/Posts"));
const PostEditor = lazy(() => import("./pages/admin/PostEditor"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const Contacts = lazy(() => import("./pages/admin/Contacts"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Users = lazy(() => import("./pages/admin/Users"));
const Carousel = lazy(() => import("./pages/admin/Carousel"));
const AdminFabrics = lazy(() => import("./pages/admin/Fabrics"));
const Newsletter = lazy(() => import("./pages/admin/Newsletter"));
const AdminTestimonials = lazy(() => import("./pages/admin/Testimonials"));
const PrintsAdmin = lazy(() => import("./pages/admin/PrintsAdmin"));
const PrintCategories = lazy(() => import("./pages/admin/PrintCategories"));
const JobOpenings = lazy(() => import("./pages/admin/JobOpenings"));
const JobApplications = lazy(() => import("./pages/admin/JobApplications"));
const Permissions = lazy(() => import("./pages/admin/Permissions"));
const SegmentsAdmin = lazy(() => import("./pages/admin/Segments"));
const AdminTechnologies = lazy(() => import("./pages/admin/Technologies"));
const RadarDigitale = lazy(() => import("./pages/RadarDigitale"));
const RadarAdmin = lazy(() => import("./pages/admin/RadarAdmin"));
const RadarTopicSuggestions = lazy(() => import("./pages/admin/RadarTopicSuggestions"));
const FabricLeads = lazy(() => import("./pages/admin/FabricLeads"));
const AgenteCRM = lazy(() => import("./pages/admin/AgenteCRM"));
const AgenteVendedor = lazy(() => import("./pages/admin/AgenteVendedor"));
const AgenteLeads = lazy(() => import("./pages/admin/AgenteLeads"));
const TrackingPixelAdmin = lazy(() => import("./pages/admin/TrackingPixel"));
const ProspeccaoIA = lazy(() => import("./pages/admin/ProspeccaoIA"));

const AgentChat = lazy(() =>
  import("./components/chat/AgentChat").then((module) => ({
    default: module.AgentChat,
  })),
);

function ConditionalAgentChat() {
  const { pathname } = useLocation();

  const isSupportedPage =
    pathname.startsWith("/tecidos") ||
    pathname.startsWith("/estampas");

  if (!isSupportedPage) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AgentChat />
    </Suspense>
  );
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true, // Força refetch quando componente monta
      staleTime: 1000 * 60 * 2, // 2 minutos - reduzido para garantir dados frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - tempo que dados ficam em cache após não serem usados
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <FavoritesProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <TrackingPixel />
            <TrackingIdentityGate />
            <Suspense
              fallback={
                <div
                  className="min-h-[40vh] flex items-center justify-center"
                  aria-live="polite"
                >
                  Carregando...
                </div>
              }
            >
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/inicio" element={<Navigate to="/" replace />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/trabalhe-conosco" element={<WorkWithUs />} />
              <Route path="/careers" element={<Navigate to="/trabalhe-conosco" replace />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/nosotros" element={<Navigate to="/sobre" replace />} />
              <Route path="/about" element={<Navigate to="/sobre" replace />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/contacto" element={<Navigate to="/contato" replace />} />
              <Route path="/contact" element={<Navigate to="/contato" replace />} />

              <Route path="/atacado" element={<WholesaleLanding />} />
              <Route path="/tecido-fitness-atacado" element={<WholesaleLanding />} />
              <Route path="/tecido-poliamida-atacado" element={<WholesaleLanding />} />
              <Route path="/tecido-moda-praia-atacado" element={<WholesaleLanding />} />
              <Route path="/tecidos" element={<Fabrics />} />
              <Route path="/tecidos/:slug" element={<FabricDetail />} />
              <Route path="/tejidos" element={<Navigate to="/tecidos" replace />} />
              <Route path="/fabrics" element={<Navigate to="/tecidos" replace />} />
              <Route path="/estampas" element={<Prints />} />
              <Route path="/estampas/catalogo" element={<PrintsCatalog />} />
              <Route path="/estampados" element={<Navigate to="/estampas" replace />} />
              <Route path="/prints" element={<Navigate to="/estampas" replace />} />
              <Route path="/segmentos" element={<Segments />} />
              <Route path="/segmentos/:slug" element={<SegmentDetail />} />
              <Route path="/segments" element={<Navigate to="/segmentos" replace />} />
              <Route path="/sustentabilidade" element={<Sustainability />} />
              <Route path="/tecnologias" element={<Technologies />} />
              <Route path="/technologies" element={<Navigate to="/tecnologias" replace />} />
              <Route path="/tecnologia" element={<Navigate to="/tecnologias" replace />} />
              <Route path="/sostenibilidad" element={<Navigate to="/sustentabilidade" replace />} />
              <Route path="/sustainability" element={<Navigate to="/sustentabilidade" replace />} />
              <Route path="/radar-digitale" element={<RadarDigitale />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/depoimentos" element={<TestimonialsPage />} />
              <Route path="/testimonials" element={<Navigate to="/depoimentos" replace />} />
              <Route path="/politica-de-privacidade" element={<Privacy />} />
              <Route path="/privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
              <Route path="/privacy" element={<Navigate to="/politica-de-privacidade" replace />} />
              <Route path="/termos" element={<Navigate to="/politica-de-privacidade" replace />} />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
              <Route path="/admin/carousel" element={<ProtectedRoute requireAdmin><Carousel /></ProtectedRoute>} />
              <Route path="/admin/fabrics" element={<ProtectedRoute requireAdmin><AdminFabrics /></ProtectedRoute>} />
              <Route path="/admin/fabric-leads" element={<ProtectedRoute allowedRoles={["sdr","vendedor"]}><FabricLeads /></ProtectedRoute>} />
              <Route path="/admin/agente-crm" element={<ProtectedRoute requireAdmin><AgenteCRM /></ProtectedRoute>} />
              <Route path="/admin/agente-vendedor" element={<ProtectedRoute requireAdmin><AgenteVendedor /></ProtectedRoute>} />
              <Route path="/admin/agente-leads" element={<ProtectedRoute requireAdmin><AgenteLeads /></ProtectedRoute>} />
              <Route path="/admin/testimonials" element={<ProtectedRoute requireAdmin><AdminTestimonials /></ProtectedRoute>} />
              <Route path="/admin/job-openings" element={<ProtectedRoute requireAdmin><JobOpenings /></ProtectedRoute>} />
              <Route path="/admin/job-applications" element={<ProtectedRoute requireAdmin><JobApplications /></ProtectedRoute>} />
              <Route path="/admin/posts" element={<ProtectedRoute requireAdmin><Posts /></ProtectedRoute>} />
              <Route path="/admin/posts/:id" element={<ProtectedRoute requireAdmin><PostEditor /></ProtectedRoute>} />
              <Route path="/admin/categories" element={<ProtectedRoute requireAdmin><Categories /></ProtectedRoute>} />
              <Route path="/admin/contacts" element={<ProtectedRoute allowedRoles={["sdr","vendedor"]}><Contacts /></ProtectedRoute>} />
              <Route path="/admin/newsletter" element={<ProtectedRoute allowedRoles={["sdr","vendedor"]}><Newsletter /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
              <Route path="/admin/permissions" element={<ProtectedRoute requireAdmin><Permissions /></ProtectedRoute>} />
              <Route path="/admin/prints" element={<ProtectedRoute requireAdmin><PrintsAdmin /></ProtectedRoute>} />
              <Route path="/admin/print-categories" element={<ProtectedRoute requireAdmin><PrintCategories /></ProtectedRoute>} />
              <Route path="/admin/segments" element={<ProtectedRoute requireAdmin><SegmentsAdmin /></ProtectedRoute>} />
              <Route path="/admin/technologies" element={<ProtectedRoute requireAdmin><AdminTechnologies /></ProtectedRoute>} />
              <Route path="/admin/radar" element={<ProtectedRoute requireAdmin><RadarAdmin /></ProtectedRoute>} />
              <Route path="/admin/radar/sugestoes" element={<ProtectedRoute requireAdmin><RadarTopicSuggestions /></ProtectedRoute>} />
              <Route path="/admin/tracking-pixel" element={<ProtectedRoute requireAdmin><TrackingPixelAdmin /></ProtectedRoute>} />
              <Route path="/admin/prospeccao-ia" element={<ProtectedRoute requireAdmin><ProspeccaoIA /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
            <WhatsAppButton />
            <ConditionalAgentChat />
            <NewsletterPopup />
          </BrowserRouter>
        </TooltipProvider>
      </FavoritesProvider>
    </AuthProvider>
  </LanguageProvider>
</QueryClientProvider>
);

export default App;
