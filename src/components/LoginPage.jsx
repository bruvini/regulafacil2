import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Hospital, Mail, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/use-toast';

const LoginPage = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [highlightForgotPassword, setHighlightForgotPassword] = useState(false);
  
  const { login } = useAuth();
  
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setHighlightForgotPassword(false);

    try {
      const result = await login(data.email, data.password);
      
      if (result.success) {
        toast({
          title: "Login realizado com sucesso",
          description: "Bem-vindo(a) ao RegulaFacil!",
        });
        onLoginSuccess();
      } else {
        setError(result.error);
        
        // Destacar "Esqueci minha senha" se erro for de senha incorreta
        if (result.error.includes('Senha não confere')) {
          setHighlightForgotPassword(true);
        }
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Recuperação de Senha",
      description: "Entre em contato com o administrador do sistema para redefinir sua senha.",
      duration: 5000,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-primary rounded-full">
              <Hospital className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              RegulaFacil
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Sistema de Gestão Hospitalar
              <br />
              Hospital Municipal São José
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail Institucional
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.nome@joinville.sc.gov.br"
                  className="pl-10"
                  disabled={isLoading}
                  {...register('email', {
                    required: 'E-mail é obrigatório',
                    pattern: {
                      value: /^[^\s@]+@joinville\.sc\.gov\.br$/,
                      message: 'E-mail deve ser @joinville.sc.gov.br'
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...register('password', {
                    required: 'Senha é obrigatória'
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-6" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className={`text-sm transition-smooth ${
                  highlightForgotPassword 
                    ? 'text-destructive hover:text-destructive/80 font-medium animate-pulse' 
                    : 'text-primary hover:text-primary-hover'
                }`}
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;