import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RegulaFacil from "./components/RegulaFacil";
import LoginPage from "./components/LoginPage";
import FirstAccessModal from "./components/FirstAccessModal";
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

  if (currentUser && isFirstLogin) {
    return (
      <>
        <RegulaFacil />
        <FirstAccessModal isOpen={true} onComplete={() => setIsFirstLogin(false)} />
      </>
    );
  }

  if (currentUser && !isFirstLogin) {
    return <RegulaFacil />;
  }

  return <LoginPage onLoginSuccess={() => {}} />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
