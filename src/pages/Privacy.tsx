import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, FileText, Lock, Eye, Database, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Privacy = () => {
  const { t } = useLanguage();

  const privacySections = [
    {
      icon: Database,
      title: t("privacy.section.data.title"),
      content: t("privacy.section.data.content"),
    },
    {
      icon: Eye,
      title: t("privacy.section.usage.title"),
      content: t("privacy.section.usage.content"),
    },
    {
      icon: Lock,
      title: t("privacy.section.security.title"),
      content: t("privacy.section.security.content"),
    },
    {
      icon: Mail,
      title: t("privacy.section.contact.title"),
      content: t("privacy.section.contact.content"),
    },
  ];

  const termsSections = [
    {
      title: t("terms.section.acceptance.title"),
      content: t("terms.section.acceptance.content"),
    },
    {
      title: t("terms.section.services.title"),
      content: t("terms.section.services.content"),
    },
    {
      title: t("terms.section.intellectual.title"),
      content: t("terms.section.intellectual.content"),
    },
    {
      title: t("terms.section.liability.title"),
      content: t("terms.section.liability.content"),
    },
    {
      title: t("terms.section.modifications.title"),
      content: t("terms.section.modifications.content"),
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <SEO title="Política de Privacidade – Digitale Têxtil" description="Conheça a Política de Privacidade da Digitale Têxtil e como tratamos seus dados pessoais conforme a LGPD." keywords="política de privacidade, LGPD, proteção de dados Digitale" />
      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-28 bg-gradient-to-br from-primary via-primary/95 to-primary/90">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-full text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                {t("privacy.label")}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                {t("privacy.title")}
              </h1>
              <p className="text-lg text-white/80">
                {t("privacy.description")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            <Tabs defaultValue="privacy" className="max-w-4xl mx-auto">
              <TabsList className="grid w-full grid-cols-2 mb-12">
                <TabsTrigger value="privacy" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("privacy.tab.privacy")}
                </TabsTrigger>
                <TabsTrigger value="terms" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t("privacy.tab.terms")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="privacy">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <div className="prose prose-lg max-w-none">
                    <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                      {t("privacy.intro")}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-muted/30 rounded-xl p-6 border border-border">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <Eye className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-foreground mb-3">
                            Dados de navegação e Tracking Pixel
                          </h3>
                          <p className="text-muted-foreground leading-relaxed">
                            Utilizamos tecnologia própria de análise para registrar, de forma pseudonimizada, páginas visitadas, origem da navegação, campanhas UTM, interações com tecidos, formulários, chat e WhatsApp, além de informações gerais de dispositivo e navegador. Não armazenamos o endereço IP nesse sistema. Algumas áreas comerciais do site exigem identificação por nome, empresa, e-mail, WhatsApp e CNPJ para acesso ao conteúdo. Quando esses dados são informados, o histórico de navegação do mesmo navegador é associado ao contato para atendimento comercial, análise de interesse e melhoria da experiência no site.
                          </p>
                        </div>
                      </div>
                    </div>

                    {privacySections.map((section, index) => (
                      <motion.div
                        key={section.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="bg-muted/30 rounded-xl p-6 border border-border"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <section.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-foreground mb-3">
                              {section.title}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                              {section.content}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-accent/10 rounded-xl border border-accent/20">
                    <p className="text-sm text-muted-foreground">
                      <strong>{t("privacy.lastUpdate")}:</strong> {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="terms">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-8"
                >
                  <div className="prose prose-lg max-w-none">
                    <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                      {t("terms.intro")}
                    </p>
                  </div>

                  <div className="space-y-6">
                    {termsSections.map((section, index) => (
                      <motion.div
                        key={section.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="border-l-4 border-primary pl-6 py-2"
                      >
                        <h3 className="text-xl font-semibold text-foreground mb-3">
                          {index + 1}. {section.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                          {section.content}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-accent/10 rounded-xl border border-accent/20">
                    <p className="text-sm text-muted-foreground">
                      <strong>{t("privacy.lastUpdate")}:</strong> {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
