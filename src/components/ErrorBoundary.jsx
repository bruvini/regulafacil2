import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 border rounded-lg bg-red-50">
          <h2 className="text-xl font-bold text-red-700">Algo deu errado</h2>
          <p className="text-sm text-red-600">
            Não foi possível carregar o componente. 
            Detalhes do erro: {this.state.error?.message}
          </p>
          <button 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
