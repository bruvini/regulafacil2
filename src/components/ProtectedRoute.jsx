import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProtectedRoute = ({ children, requiredRoute }) => {
  const { currentUser, loading, logout } = useAuth();

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verificando autenticação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário não autenticado - será redirecionado pelo RegulaFacil
  if (!currentUser) {
    return null;
  }

  const isPublicAuthenticatedRoute = requiredRoute === '/informacoes';

  if (isPublicAuthenticatedRoute) {
    return children;
  }

  // Verificar permissões para a rota atual
  const hasAccess = () => {
    // Administradores têm acesso a tudo
    if (currentUser.tipoUsuario === 'Administrador') {
      return true;
    }

    // Usuários comuns precisam ter permissão específica
    if (currentUser.tipoUsuario === 'Comum') {
      return currentUser.permissoes && currentUser.permissoes.includes(requiredRoute);
    }

    return false;
  };

  // Usuário sem permissão para esta rota
  if (!hasAccess()) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="shadow-card max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto mb-6">
              <Shield className="h-12 w-12 text-destructive" />
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Acesso Negado
            </h2>
            
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você não possui permissão para acessar esta página. 
                Entre em contato com um administrador do sistema para solicitar acesso.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>Usuário:</strong> {currentUser.nomeCompleto}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Tipo:</strong> {currentUser.tipoUsuario}
              </p>
              
              <div className="flex gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={logout}
                  variant="destructive"
                  className="flex-1"
                >
                  Sair do Sistema
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário tem acesso - renderizar conteúdo
  return children;
};

export default ProtectedRoute;