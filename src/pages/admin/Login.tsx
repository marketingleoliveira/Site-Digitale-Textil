import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoColor from "@/assets/logo-color.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, isAdmin, isEditor, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect when user is authenticated AND has roles
  useEffect(() => {
    if (!loading && user && (isAdmin || isEditor)) {
      navigate("/admin", { replace: true });
    }
  }, [loading, user, isAdmin, isEditor, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast.error("Erro ao fazer login", {
          description: "Verifique suas credenciais e tente novamente."
        });
      } else {
        toast.success("Login realizado com sucesso!");
        // The auth subscription loads roles before the effect redirects.
      }
    } catch {
      toast.error("Não foi possível fazer login. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-3xl p-8 md:p-10 border border-border shadow-lg">
          <div className="text-center mb-8">
            <img src={logoColor} alt="Digitale Têxtil" className="h-12 mx-auto mb-6" />
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Painel Administrativo
            </h1>
            <p className="text-muted-foreground mt-2">
              Faça login para acessar o painel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <LogIn className="mr-2 h-4 w-4" />
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Voltar ao site
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
