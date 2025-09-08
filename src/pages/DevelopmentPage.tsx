import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, Clock, Wrench } from "lucide-react";

interface DevelopmentPageProps {
  title: string;
  description?: string;
}

const DevelopmentPage = ({ title, description }: DevelopmentPageProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md shadow-card text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Construction className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-base mt-2">
                {description}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Em Desenvolvimento</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Funcionalidades disponíveis em breve
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Atualizações em andamento</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevelopmentPage;