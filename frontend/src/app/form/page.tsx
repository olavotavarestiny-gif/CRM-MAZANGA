'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createContact } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const REVENUE_OPTIONS = [
  '- 50M de Kz',
  '50M - 100M de Kz',
  '100M - 500M de Kz',
  '+ 500M de Kz',
];

const SECTOR_OPTIONS = [
  'Serviços',
  'Construção',
  'Retalho',
  'Energia',
  'Oil & Gas',
  'Logística',
  'E-commerce',
  'Telecomunicações',
];

export default function FormPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    revenue: '',
    sector: '',
    stage: 'Novo',
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createContact(formData as any),
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          revenue: '',
          sector: '',
          stage: 'Novo',
        });
        setSubmitted(false);
      }, 3000);
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-purple-950/20 to-black p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <h2 className="text-2xl font-bold text-green-400 mb-2">
              Sucesso!
            </h2>
            <p className="text-slate-500">
              Obrigado! Entraremos em contacto em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-purple-950/20 to-black p-4">
      <Card className="w-full max-w-md backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-syne">Solicitar Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="company">Empresa *</Label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <Label htmlFor="revenue">Faturamento Anual</Label>
              <Select
                value={formData.revenue}
                onValueChange={(value) => handleSelectChange('revenue', value)}
              >
                <SelectTrigger id="revenue">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sector">Setor</Label>
              <Select
                value={formData.sector}
                onValueChange={(value) => handleSelectChange('sector', value)}
              >
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>

            {mutation.isError && (
              <p className="text-red-600 text-sm">
                Erro ao enviar. Tente novamente.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
