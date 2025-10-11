import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const InformacoesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Informações e Políticas</h1>
        <p className="text-muted-foreground mt-2">
          Este espaço reunirá orientações institucionais, diretrizes de segurança e detalhes sobre conformidade com a LGPD.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sobre o RegulaFácil</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Conteúdo em desenvolvimento.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança da Informação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Conteúdo em desenvolvimento.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Política de Uso e Termos de Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Conteúdo em desenvolvimento.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conformidade com a LGPD</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Conteúdo em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InformacoesPage;
