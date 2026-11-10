import { motion } from "framer-motion";
import { Leaf, Droplets, Zap, Recycle, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export function Sustainability() {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Recycle,
      stat: "500K+",
      statLabel: "garrafas recicladas/mês",
      color: "from-emerald-500 to-green-600",
    },
    {
      icon: Leaf,
      stat: "40%",
      statLabel: "menos emissões de CO₂",
      color: "from-green-500 to-teal-600",
    },
    {
      icon: Droplets,
      stat: "60%",
      statLabel: "economia de água",
      color: "from-cyan-500 to-blue-600",
    },
    {
      icon: Zap,
      stat: "30%",
      statLabel: "energia renovável",
      color: "from-yellow-500 to-orange-500",
    },
  ];

  const certifications = [
    "ISO 14001",
    "OEKO-TEX®",
    "Bluesign®",
    "GRS Certified",
  ];

  return (
    <section data-digitale-sustainability="true" className="py-20 md:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50/50 to-teal-50/30 dark:from-emerald-950/30 dark:via-green-950/20 dark:to-teal-950/10" />
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-green-200/30 dark:bg-green-800/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-200/30 dark:bg-emerald-800/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Label */}
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold mb-6 shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              {t("sustainability.label")}
            </motion.span>
            
            {/* Title */}
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              {t("sustainability.title")}
            </h2>
            
            {/* Description */}
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-10 max-w-xl">
              {t("sustainability.description")}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 md:gap-5 mb-10">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.statLabel}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-xl border border-green-100/50 dark:border-green-900/30 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${benefit.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <benefit.icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {benefit.stat}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{benefit.statLabel}</p>
                </motion.div>
              ))}
            </div>

            {/* Certifications */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-2 md:gap-3 mb-8"
            >
              {certifications.map((cert) => (
                <span
                  key={cert}
                  className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-full text-xs md:text-sm font-medium text-foreground border border-green-200/50 dark:border-green-800/30 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {cert}
                </span>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <Link
                to="/sustentabilidade"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-green-600/30 hover:-translate-y-0.5 group"
              >
                {t("sustainability.cta")}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-2xl scale-110" />
              
              {/* Animated Rings */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-dashed border-green-300/60 dark:border-green-700/40 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                className="absolute inset-6 border-2 border-dashed border-green-400/50 dark:border-green-600/40 rounded-full"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-12 border-2 border-dashed border-emerald-400/60 dark:border-emerald-600/50 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[72px] border-2 border-dashed border-emerald-500/50 dark:border-emerald-500/40 rounded-full"
              />
              
              {/* Center Content */}
              <div className="absolute inset-24 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30">
                <div className="text-center text-white">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <Recycle className="h-12 w-12 mx-auto mb-2" />
                  </motion.div>
                  <p className="text-4xl font-bold">100%</p>
                  <p className="text-sm opacity-90 font-medium">{t("sustainability.sustainable")}</p>
                </div>
              </div>

              {/* Floating Icons */}
              <motion.div
                animate={{ y: [-8, 8, -8] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-2 right-8 w-14 h-14 bg-white rounded-2xl shadow-xl shadow-green-200/50 flex items-center justify-center border border-green-100"
              >
                <Leaf className="h-7 w-7 text-green-500" />
              </motion.div>
              <motion.div
                animate={{ y: [8, -8, 8] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-2 left-8 w-14 h-14 bg-white rounded-2xl shadow-xl shadow-blue-200/50 flex items-center justify-center border border-blue-100"
              >
                <Droplets className="h-7 w-7 text-blue-500" />
              </motion.div>
              <motion.div
                animate={{ x: [-6, 6, -6] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 -right-4 w-14 h-14 bg-white rounded-2xl shadow-xl shadow-emerald-200/50 flex items-center justify-center border border-emerald-100"
              >
                <Zap className="h-7 w-7 text-amber-500" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
