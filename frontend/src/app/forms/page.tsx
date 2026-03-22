'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getForms, createForm, deleteForm, getCurrentUser } from '@/lib/api';
import type { User } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Copy, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FormsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createForm({
        title: 'Novo Formulário',
        mode: 'step',
      }),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      router.push(`/forms/${form.id}/edit`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });

  const copyLink = (formId: string) => {
    const link = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(link);
    setCopied(formId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-3xl font-bold">Formulários</h1>
        <Button onClick={() => createMutation.mutate()} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Formulário
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="pt-8 text-center text-gray-500">
            <p>Nenhum formulário criado ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{form.title}</CardTitle>
                  <Badge>{form.mode === 'step' ? 'Passo a Passo' : 'Corrido'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.description && (
                  <p className="text-sm text-gray-500">{form.description}</p>
                )}
                <div className="text-sm text-gray-400">
                  <p>{form.fields?.length || 0} campos</p>
                  <p>{form._count?.submissions || 0} submissões</p>
                  <p className="text-xs mt-2">
                    {formatDistanceToNow(new Date(form.createdAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/forms/${form.id}/edit`)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyLink(form.id)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied === form.id ? 'Copiado!' : 'Link'}
                  </Button>
                  {!currentUser?.accountOwnerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(form.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
