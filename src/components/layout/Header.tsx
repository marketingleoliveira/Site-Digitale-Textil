import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Clock, Headphones, ChevronDown } from "lucide-react";
import logoColor from "@/assets/logo-color-header.webp";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";


interface NavItem {
  name: string;
  href: string;
  children?: { name: string; href: string }[];
}
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useLanguage();
  const { whatsappLink } = useSiteSettings();

  const navigation: NavItem[] = [
    { name: t("nav.home"), href: "/" },
    {
      name: t("nav.about"),
      href: "/sobre",
      children: [
        { name: t("nav.about"), href: "/sobre" },
        { name: t("nav.sustainability"), href: "/sustentabilidade" },
        { name: "TECNOLOGIAS", href: "/tecnologias" },
      ]
    },
    { name: t("nav.fabrics"), href: "/tecidos" },
    { name: t("nav.prints"), href: "/estampas" },

    { name: t("nav.careers"), href: "/trabalhe-conosco" },
    { name: "RADAR DIGITALE", href: "/radar-digitale" },
    { name: t("nav.blog"), href: "/blog" },
  ];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const commercialWhatsappLink = whatsappLink("Olá, vim do site, quero contato do time comercial");

  return (
    <>
      {/* Top Bar - Desktop */}
      <div className="bg-primary text-primary-foreground text-xs md:text-sm hidden md:block">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-9 md:h-10">
            <div className="flex items-center gap-4 md:gap-6">
              <a
                href={commercialWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 md:gap-2 hover:text-accent transition-colors"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                <span>Falar com Comercial</span>
              </a>
              <div className="hidden lg:flex items-center gap-2 text-primary-foreground/70">
                <Clock className="h-3.5 w-3.5" />
                <span>Seg-Sex: 08:00 - 18:00</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white shadow-lg py-2"
            : "bg-white/95 backdrop-blur-md py-3 md:py-4"
        }`}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between">
            {/* Logo + Depoimentos Button */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <Link to="/" className="flex-shrink-0">
                <img
                  src={logoColor}
                  alt="Digitale Têxtil"
                  className={`transition-all duration-300 ${isScrolled ? "h-10 md:h-12" : "h-11 md:h-14 lg:h-16"}`}
                />
              </Link>
              <Link
                to="/depoimentos"
                className={`inline-flex items-center px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-full text-xs md:text-sm font-semibold border-2 transition-colors ${
                  location.pathname === "/depoimentos"
                    ? "bg-accent text-white border-accent"
                    : "border-accent text-accent hover:bg-accent hover:text-white"
                }`}
                aria-label="Depoimentos"
              >
                <span>Depoimentos</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center">
              {navigation.map((item) => (
                item.children ? (
                  <div
                    key={item.name}
                    className="relative group"
                    onMouseEnter={() => setOpenSubmenu(item.name)}
                    onMouseLeave={() => setOpenSubmenu(null)}
                  >
                    <button
                      className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                        location.pathname === item.href || item.children.some(c => location.pathname === c.href)
                          ? "text-accent"
                          : "text-foreground hover:text-accent"
                      }`}
                    >
                      {item.name}
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSubmenu === item.name ? 'rotate-180' : ''}`} />
                    </button>

                      {openSubmenu === item.name && (
                          <div
                            className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-border py-2 min-w-[180px] z-50"
                          >
                            {item.children.map((child) => (
                              <Link
                                key={child.name}
                                to={child.href}
                                className={`block px-4 py-2 text-sm transition-colors ${
                                  location.pathname === child.href
                                    ? "text-accent bg-accent/5"
                                    : "text-foreground hover:text-accent hover:bg-accent/5"
                                }`}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                      )}

                  </div>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative group ${
                      location.pathname === item.href
                        ? "text-accent"
                        : "text-foreground hover:text-accent"
                    }`}
                  >
                    {item.name}
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </Link>
                )
              ))}
            </nav>

            {/* CTA + SAC */}
            <div className="hidden lg:flex items-center gap-3">
              <a
                href="https://sac.digitaletextil.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-2 border-accent text-accent rounded-full hover:bg-accent hover:text-white transition-colors"
              >
                <Headphones className="h-4 w-4" />
                SAC
              </a>
              <Link
                to="/contato"
                className="btn-primary text-sm"
              >
                {t("cta.button")}
              </Link>
            </div>

            {/* Mobile: Language + Menu Button */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="md:hidden">
                <LanguageSwitcher />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-foreground hover:text-accent transition-colors"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}

          {isMobileMenuOpen && (
            <div
              className="lg:hidden bg-white border-t border-border overflow-hidden"
            >
              <nav className="container mx-auto px-4 py-4">
                {/* WhatsApp Link for Mobile */}
                <a
                  href={commercialWhatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-3 text-accent font-medium border-b border-border/50"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Falar com Comercial</span>
                </a>

                {navigation.map((item) => (
                  item.children ? (
                    <div key={item.name}>
                      <button
                        onClick={() => setOpenSubmenu(openSubmenu === item.name ? null : item.name)}
                        className={`flex items-center justify-between w-full py-3 font-medium border-b border-border/50 ${
                          location.pathname === item.href || item.children.some(c => location.pathname === c.href)
                            ? "text-accent"
                            : "text-foreground"
                        }`}
                      >
                        {item.name}
                        <ChevronDown className={`h-4 w-4 transition-transform ${openSubmenu === item.name ? 'rotate-180' : ''}`} />
                      </button>

                        {openSubmenu === item.name && (
                          <div
                            className="overflow-hidden bg-muted/30"
                          >
                            {item.children.map((child) => (
                              <Link
                                key={child.name}
                                to={child.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2.5 pl-6 text-sm border-b border-border/30 ${
                                  location.pathname === child.href ? "text-accent" : "text-foreground"
                                }`}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        )}

                    </div>
                  ) : (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block py-3 font-medium border-b border-border/50 ${
                        location.pathname === item.href ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                ))}
                <Link
                  to="/contato"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block mt-4 btn-primary text-center text-sm py-3"
                >
                  {t("cta.button")}
                </Link>
              </nav>
            </div>
          )}

      </header>
    </>
  );
}
