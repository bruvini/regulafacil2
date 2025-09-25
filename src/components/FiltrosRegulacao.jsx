import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Filter, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ESPECIALIDADES_MEDICAS } from "@/lib/constants";

const defaultFilters = {
  searchTerm: '',
  especialidade: 'todos',
  sexo: 'todos',
  idadeMin: '',
  idadeMax: '',
  tempoInternacaoMin: '',
  tempoInternacaoMax: '',
  unidadeTempo: 'dias'
};

const defaultSort = { key: 'nome', direction: 'asc' };

const sexoOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' }
];

const sortOptions = [
  { key: 'nome', label: 'Nome' },
  { key: 'idade', label: 'Idade' },
  { key: 'tempoInternacao', label: 'Tempo Internação' }
];

const FiltrosRegulacao = ({
  filtros,
  setFiltros,
  sortConfig,
  setSortConfig,
  initialFilters = defaultFilters,
  defaultSortConfig = defaultSort
}) => {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFiltros((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field) => (value) => {
    setFiltros((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClearFilters = () => {
    setFiltros({ ...initialFilters });
    setSortConfig({ ...defaultSortConfig });
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          Filtros e Pesquisa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex w-full flex-col gap-1 md:max-w-sm">
            <Label className="text-xs uppercase text-muted-foreground">Pesquisar por nome</Label>
            <Input
              placeholder="Digite o nome do paciente"
              value={filtros.searchTerm}
              onChange={handleInputChange('searchTerm')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:flex-1 md:justify-center">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Ordenar por</span>
            {sortOptions.map((option) => {
              const isActive = sortConfig.key === option.key;
              return (
                <Button
                  key={option.key}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => toggleSort(option.key)}
                >
                  {option.label}
                  {getSortIcon(option.key)}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={advancedFiltersOpen ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
              aria-expanded={advancedFiltersOpen}
            >
              <Filter className="h-4 w-4" />
              Filtros Avançados
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={handleClearFilters}
            >
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </div>

        <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <CollapsibleContent className="space-y-4 rounded-md border border-dashed border-border bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <Label className="text-xs uppercase text-muted-foreground">Especialidade</Label>
                <Select value={filtros.especialidade} onValueChange={handleSelectChange('especialidade')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {ESPECIALIDADES_MEDICAS.map((especialidade) => (
                      <SelectItem key={especialidade} value={especialidade}>
                        {especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs uppercase text-muted-foreground">Sexo</Label>
                <Select value={filtros.sexo} onValueChange={handleSelectChange('sexo')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {sexoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Idade mín.</Label>
                  <Input
                    type="number"
                    min="0"
                    value={filtros.idadeMin}
                    onChange={handleInputChange('idadeMin')}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Idade máx.</Label>
                  <Input
                    type="number"
                    min="0"
                    value={filtros.idadeMax}
                    onChange={handleInputChange('idadeMax')}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Tempo mín.</Label>
                  <Input
                    type="number"
                    min="0"
                    value={filtros.tempoInternacaoMin}
                    onChange={handleInputChange('tempoInternacaoMin')}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Tempo máx.</Label>
                  <Input
                    type="number"
                    min="0"
                    value={filtros.tempoInternacaoMax}
                    onChange={handleInputChange('tempoInternacaoMax')}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Unidade</Label>
                  <Select value={filtros.unidadeTempo} onValueChange={handleSelectChange('unidadeTempo')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Dias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dias">Dias</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default FiltrosRegulacao;
