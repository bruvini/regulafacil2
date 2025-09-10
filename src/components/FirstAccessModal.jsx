import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Lock, Eye, EyeOff, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/use-toast';

const FirstAccessModal = ({ isOpen, onComplete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { updateUserPassword, updateLoginAudit } = useAuth();
  
  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm();
  
  const watchPassword = watch('newPassword', '');
  const watchConfirmPassword = watch('confirmPassword', '');

  // Calcular força da senha
  useEffect(() => {
    const calculateStrength = (password) => {
      if (!password) return 0;
      
      let strength = 0;
      const checks = [
        password.length >= 6,                    // Mínimo 6 caracteres
        /[A-Z]/.test(password),                 // Pelo menos uma maiúscula
        /[a-z]/.test(password),                 // Pelo menos uma minúscula
        /\d/.test(password),                    // Pelo menos um número
        /[!@#$%^&*(),.?":{}|<>]/.test(password) // Pelo menos um caractere especial
      ];
      
      strength = checks.filter(Boolean).length;
      return (strength / 5) * 100;
    };
    
    setPasswordStrength(calculateStrength(watchPassword));
  }, [watchPassword]);

  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 6,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    return requirements;
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    
    const requirements = validatePassword(data.newPassword);
    const allRequirementsMet = Object.values(requirements).every(Boolean);
    
    if (!allRequirementsMet) {
      setError('newPassword', {
        type: 'validation',
        message: 'A senha não atende a todos os requisitos'
      });
      setIsLoading(false);
      return;
    }

    if (data.newPassword !== data.confirmPassword) {
      setError('confirmPassword', {
        type: 'validation',
        message: 'As senhas não coincidem'
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await updateUserPassword(data.newPassword);
      
      if (result.success) {
        // Atualizar auditoria após troca de senha bem-sucedida
        await updateLoginAudit();
        
        toast({
          title: "Senha atualizada com sucesso",
          description: "Sua senha foi alterada e você pode continuar usando o sistema.",
        });
        
        onComplete();
      } else {
        setError('newPassword', {
          type: 'server',
          message: result.error
        });
      }
    } catch (error) {
      setError('newPassword', {
        type: 'server',
        message: 'Erro inesperado ao atualizar senha'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requirements = validatePassword(watchPassword);
  const getStrengthColor = () => {
    if (passwordStrength < 40) return 'bg-destructive';
    if (passwordStrength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 40) return 'Fraca';
    if (passwordStrength < 80) return 'Média';
    return 'Forte';
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Key className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl">
            Primeiro Acesso: Crie sua Nova Senha
          </DialogTitle>
          <DialogDescription>
            Por motivos de segurança, você deve alterar a senha padrão antes de acessar o sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <strong>Requisitos da senha:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  {requirements.length ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                  )}
                  Mínimo 6 caracteres
                </li>
                <li className="flex items-center gap-2">
                  {requirements.uppercase ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                  )}
                  Uma letra maiúscula
                </li>
                <li className="flex items-center gap-2">
                  {requirements.number ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                  )}
                  Um número
                </li>
                <li className="flex items-center gap-2">
                  {requirements.special ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                  )}
                  Um caractere especial (!@#$%^&*)
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua nova senha"
                className="pl-10 pr-10"
                disabled={isLoading}
                {...register('newPassword', {
                  required: 'Nova senha é obrigatória'
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
            
            {watchPassword && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Progress value={passwordStrength} className="flex-1 h-2" />
                  <span className="text-sm font-medium">{getStrengthText()}</span>
                </div>
              </div>
            )}
            
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirme sua nova senha"
                className="pl-10 pr-10"
                disabled={isLoading}
                {...register('confirmPassword', {
                  required: 'Confirmação de senha é obrigatória'
                })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            
            {watchConfirmPassword && watchPassword !== watchConfirmPassword && (
              <p className="text-sm text-destructive">As senhas não coincidem</p>
            )}
            
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={
              isLoading || 
              passwordStrength < 80 || 
              !watchConfirmPassword || 
              watchPassword !== watchConfirmPassword
            }
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                Salvando Nova Senha...
              </>
            ) : (
              'Salvar Nova Senha'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FirstAccessModal;