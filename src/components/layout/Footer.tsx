import { Link } from "react-router-dom";
import { Instagram, Youtube, Linkedin, Facebook, MapPin, Mail } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

const socialLinks = [
  { name: "Instagram", icon: Instagram, href: "https://www.instagram.com/digitale.textil/" },
  { name: "YouTube", icon: Youtube, href: "https://www.youtube.com/channel/UClXf0Er4nwHyq6EFuSmNSrw" },
  { name: "LinkedIn", icon: Linkedin, href: "https://www.linkedin.com/company/digitale-textil-loja/" },
  { name: "Facebook", icon: Facebook, href: "https://www.facebook.com/digitaletextilbr/" },
];

export function Footer() {
  const { t } = useLanguage();
  const { whatsappNumber, whatsappLink } = useSiteSettings();

  // Format phone number for display
  const formatPhoneNumber = (number: string) => {
    // Assuming Brazilian format: 55 + DDD + number
    if (number.startsWith("55") && number.length >= 12) {
      const ddd = number.slice(2, 4);
      const part1 = number.slice(4, 9);
      const part2 = number.slice(9);
      return `${ddd} ${part1}-${part2}`;
    }
    return number;
  };

  const footerLinks = {
    empresa: [
      { name: t("nav.about"), href: "/sobre" },
      { name: t("nav.sustainability"), href: "/sustentabilidade" },
      { name: "Radar Digitale", href: "/radar-digitale" },
      { name: t("nav.contact"), href: "/contato" },
      { name: t("nav.blog"), href: "/blog" },
    ],
    produtos: [
      { name: "Milano", href: "/tecidos/milano" },
      { name: "Lyon", href: "/tecidos/lyon" },
      { name: "Aerodry", href: "/tecidos/aerodry" },
      { name: "Veneza", href: "/tecidos/veneza" },
    ],
  };

  return (
    <footer className="bg-primary text-white">
      {/* Newsletter Section */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="grid lg:grid-cols-2 gap-6 md:gap-8 items-center">
            <div className="text-center lg:text-left">
              <h3 className="text-xl md:text-2xl font-bold mb-2">{t("newsletter.title")}</h3>
              <p className="text-white/70 text-sm md:text-base">{t("newsletter.subtitle")}</p>
            </div>
            <div className="lg:max-w-md lg:ml-auto">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2 lg:col-span-1">
            <img src={logoWhite} alt="Digitale Têxtil" className="h-10 md:h-14 mb-4 md:mb-6" />
            <p className="text-white/70 text-sm leading-relaxed mb-4 md:mb-6">
              {t("footer.description")}
            </p>
            <div className="flex gap-2 md:gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-accent transition-all duration-300"
                >
                  <social.icon className="h-4 w-4 md:h-5 md:w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-semibold text-base md:text-lg mb-4 md:mb-6">{t("footer.navigation")}</h4>
            <ul className="space-y-2 md:space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.href} 
                    className="text-white/70 hover:text-accent transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tecidos */}
          <div>
            <h4 className="font-semibold text-base md:text-lg mb-4 md:mb-6">{t("nav.fabrics")}</h4>
            <ul className="space-y-2 md:space-y-3">
              {footerLinks.produtos.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.href} 
                    className="text-white/70 hover:text-accent transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-semibold text-base md:text-lg mb-4 md:mb-6">{t("footer.contact")}</h4>
            <ul className="space-y-3 md:space-y-4 text-sm text-white/70">
              <li>
                <a href="mailto:atendimento@digitaletextil.com.br" className="flex items-start gap-2 md:gap-3 hover:text-accent transition-colors">
                  <Mail className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5" />
                  <span className="break-all">atendimento@digitaletextil.com.br</span>
                </a>
              </li>
              <li>
                <a 
                  href={whatsappLink()} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 md:gap-3 hover:text-accent transition-colors"
                >
                  <WhatsAppIcon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5" />
                  <span>{formatPhoneNumber(whatsappNumber)}</span>
                </a>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <MapPin className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5" />
                <span>
                  Av. Henry Ford, 354<br />
                  São Paulo-SP, 03109-000
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 text-xs md:text-sm text-white/50">
            <div className="text-center md:text-left space-y-1">
              <p>© {new Date().getFullYear()} Digitale Têxtil. {t("footer.rights")}</p>
              <p className="text-white/40">CNPJ: 74.447.996/0001-14</p>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <Link 
                to="/politica-de-privacidade" 
                className="hover:text-white/80 transition-colors"
              >
                {t("footer.privacy")}
              </Link>
              <a
                href="/admin/login"
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                {t("footer.admin")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
