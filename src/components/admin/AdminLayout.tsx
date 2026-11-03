import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  ChevronDown,
  Images,
  Palette,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/logo-white.png";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

import { Mail, Quote, Briefcase, FileCheck, ShieldCheck, Flame, Target, Layers, Lightbulb, Cpu, ChartNoAxesCombined } from "lucide-react";

type MenuItem = {
  icon: any;
  label: string;
  href?: string;
  adminOnly?: boolean;
  allowedRoles?: string[]; // if defined, only these roles (besides admin/dev) can see
  children?: MenuItem[];
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin", adminOnly: true },
  { icon: Images, label: "Carrossel", href: "/admin/carousel", adminOnly: true },
  { icon: FolderOpen, label: "Tecidos", href: "/admin/fabrics", adminOnly: true },
  {
    icon: Target,
    label: "LEADS",
    children: [
      { icon: MessageSquare, label: "Leads Tecidos", href: "/admin/fabric-leads", allowedRoles: ["sdr", "vendedor"] },
      { icon: Bot, label: "Agente CRM", href: "/admin/agente-crm", adminOnly: true },
      { icon: Target, label: "Prospecção IA", href: "/admin/prospeccao-ia", adminOnly: true },
      { icon: MessageSquare, label: "Agente Vendedor", href: "/admin/agente-vendedor", adminOnly: true },
      { icon: Flame, label: "Leads Agente", href: "/admin/agente-leads", adminOnly: true },
    ],
  },
  { icon: Palette, label: "Estampas", href: "/admin/prints", adminOnly: true },
  { icon: Layers, label: "Segmentos", href: "/admin/segments", adminOnly: true },
  { icon: Cpu, label: "Tecnologias", href: "/admin/technologies", adminOnly: true },
  { icon: Quote, label: "Depoimentos", href: "/admin/testimonials", adminOnly: true },
  { icon: Briefcase, label: "Vagas", href: "/admin/job-openings", adminOnly: true },
  { icon: FileCheck, label: "Candidaturas", href: "/admin/job-applications", adminOnly: true },
  { icon: FileText, label: "Posts", href: "/admin/posts", adminOnly: true },
  { icon: FolderOpen, label: "Categorias", href: "/admin/categories", adminOnly: true },
  { icon: MessageSquare, label: "Contatos", href: "/admin/contacts", allowedRoles: ["sdr", "vendedor"] },
  { icon: Mail, label: "Newsletter", href: "/admin/newsletter", allowedRoles: ["sdr", "vendedor"] },
  { icon: FileText, label: "Radar Digitale", href: "/admin/radar", adminOnly: true },
  { icon: Lightbulb, label: "Sugestões Radar", href: "/admin/radar/sugestoes", adminOnly: true },
  { icon: ChartNoAxesCombined, label: "Tracking Pixel", href: "/admin/tracking-pixel", adminOnly: true },
  { icon: Users, label: "Usuários", href: "/admin/users", adminOnly: true },
  { icon: ShieldCheck, label: "Permissões", href: "/admin/permissions", adminOnly: true },
  { icon: Settings, label: "Configurações", href: "/admin/settings", adminOnly: true },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, role, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    LEADS:
      location.pathname === "/admin/fabric-leads" ||
      location.pathname.startsWith("/admin/agente"),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const filterByRole = (it: MenuItem) => {
    if (isAdmin) return true;
    if (it.adminOnly) return false;
    if (it.allowedRoles && role) return it.allowedRoles.includes(role);
    return !it.adminOnly && !it.allowedRoles;
  };
  const filteredMenuItems = menuItems.filter(filterByRole);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-primary z-50 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="text-primary-foreground p-1">
          <Menu className="h-6 w-6" />
        </button>
        <img src={logoWhite} alt="Digitale" className="h-7" />
        <div className="w-6" />
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-primary z-50 transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-6 border-b border-primary-foreground/10">
            <img src={logoWhite} alt="Digitale" className="h-8 lg:h-10" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-primary-foreground/70 hover:text-primary-foreground p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 lg:py-6 px-2 lg:px-3 space-y-1 overflow-y-auto">
            {filteredMenuItems.map((item) => {
              if (item.children) {
                const visibleChildren = item.children.filter(filterByRole);
                if (!visibleChildren.length) return null;
                const isOpen = !!openGroups[item.label];
                const groupActive = visibleChildren.some((c) => c.href === location.pathname);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !isOpen }))}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-sm font-medium transition-colors",
                        groupActive
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="mt-1 ml-3 pl-3 border-l border-primary-foreground/15 space-y-1">
                        {visibleChildren.map((c) => {
                          const cActive = location.pathname === c.href;
                          return (
                            <Link
                              key={c.href}
                              to={c.href!}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                cActive
                                  ? "bg-primary-foreground text-primary"
                                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                              )}
                            >
                              <c.icon className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{c.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href!}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 lg:p-4 border-t border-primary-foreground/10">
            <div className="flex items-center gap-2 lg:gap-3 px-2 lg:px-3 mb-2 lg:mb-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-medium text-sm lg:text-base">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs lg:text-sm font-medium text-primary-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-primary-foreground/60">
                  {isAdmin ? "DEV" : (role ? role.toUpperCase() : "—")}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-semibold text-foreground mb-4 md:mb-6">
              {title}
            </h1>
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
