'use client';

import { Contact, Stage } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateContact } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

const STAGES: Stage[] = ['Novo', 'Contactado', 'Qualificado', 'Proposta Enviada', 'Fechado', 'Perdido'];
const STAGE_LABELS: Record<Stage, string> = {
  Novo: 'Novo',
  Contactado: 'Contactado',
  Qualificado: 'Qualificado',
  'Proposta Enviada': 'Proposta Enviada',
  Fechado: 'Fechado',
  Perdido: 'Perdido',
};
const STAGE_COLORS: Record<Stage, string> = {
  Novo: 'bg-blue-100 text-blue-800',
  Contactado: 'bg-yellow-100 text-yellow-800',
  Qualificado: 'bg-purple-100 text-purple-800',
  'Proposta Enviada': 'bg-orange-100 text-orange-800',
  Fechado: 'bg-green-100 text-green-800',
  Perdido: 'bg-gray-100 text-gray-800',
};

export default function KanbanBoard({ contacts }: { contacts: Contact[] }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (params: { id: number; stage: Stage }) =>
      updateContact(params.id.toString(), { stage: params.stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const handleStageChange = (contactId: number, stage: Stage) => {
    mutation.mutate({ id: contactId, stage });
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {STAGES.map((stage) => (
        <div key={stage} className="bg-gray-50 rounded-lg p-4 min-h-96">
          <h3 className="font-semibold mb-4 text-gray-900">
            {STAGE_LABELS[stage]}
          </h3>
          <div className="space-y-3">
            {contacts
              .filter((c) => c.stage === stage)
              .map((contact) => (
                <Card
                  key={contact.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-white"
                >
                  <Link href={`/contacts/${contact.id}`}>
                    <div className="mb-2">
                      <p className="font-medium text-sm text-gray-900">
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-500">{contact.phone}</p>
                    </div>
                  </Link>

                  <div className="mb-2">
                    {contact.company && (
                      <p className="text-xs text-gray-600">{contact.company}</p>
                    )}
                  </div>

                  <Select
                    value={stage}
                    onValueChange={(value) =>
                      handleStageChange(contact.id, value as Stage)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
