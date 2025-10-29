import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RegulaFacil from "./components/RegulaFacil";
import LoginPage from "./components/LoginPage";
import FirstAccessModal from "./components/FirstAccessModal";
import RegulacoesAtivasPage from "./pages/RegulacoesAtivasPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Card, CardContent } from "./components/ui/card";

const queryClient = new QueryClient();

const AppContent = () => {
  const { currentUser, loading, isFirstLogin, setIsFirstLogin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rota Pública - Regulações Ativas */}
      <Route path="/regulacoes_ativas" element={<RegulacoesAtivasPage />} />
      
      {/* Rota de Login */}
      <Route 
        path="/login" 
        element={
          currentUser ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={() => {}} />
        } 
      />
      
      {/* Rota Principal - Protegida */}
      <Route 
        path="/" 
        element={
          currentUser ? (
            <>
              <RegulaFacil />
              {isFirstLogin && (
                <FirstAccessModal 
                  isOpen={true} 
                  onComplete={() => setIsFirstLogin(false)} 
                />
              )}
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      
      {/* Redirecionar rotas desconhecidas para home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
