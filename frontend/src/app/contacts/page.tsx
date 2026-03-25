'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getCurrentUser,
  getPipelineStages,
  getContactFieldConfigs,
} from '@/lib/api';
import type { User } from '@/lib/api';
import { Contact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import ContactForm from '@/components/contacts/contact-form';
import ImportCSVModal from '@/components/contacts/import-csv-modal';
import ContactFieldsManager from '@/components/contacts/contact-fields-manager';
import Link from 'next/link';
import { Trash2, MessageCircle, Upload, Settings2, Phone } from 'lucide-react';
import { getContactFieldDefs } from '@/lib/api';

function formatWA(phone: string): string | null {
  if (!phone) return null;
  let n = phone.replace(/[\s\-\(\)\+]/g, '');
  if (n.length <= 9 && !n.startsWith('244')) n = '244' + n;
  return n.length >= 9 ? n : null;
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [revenueFilter, setRevenueFilter] = useState<string>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [contactTypeTab, setContactTypeTab] = useState<'interessado' | 'cliente'>('interessado');

  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
  });

  const { data: systemConfigs = [] } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    staleTime: 0,
  });

  // System columns to show (excluding fields already rendered in dedicated columns/UI)
  const visibleSystemCols = systemConfigs
    .filter(c => c.visible && !['name', 'phone'].includes(c.fieldKey))
    .sort((a, b) => a.order - b.order);

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', search, stageFilter, revenueFilter, contactTypeTab],
    queryFn: () =>
      getContacts({
        search: search || undefined,
        stage: stageFilter === 'ALL' ? undefined : stageFilter,
        revenue: revenueFilter === 'ALL' ? undefined : revenueFilter,
        contactType: contactTypeTab,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Contactos</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsFieldsOpen(true)}
            className="w-full sm:w-auto"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Personalizar campos
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button data-tour="contacts-new" className="w-full sm:w-auto">Novo Contacto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Contacto</DialogTitle>
              </DialogHeader>
              <ContactForm
                onSuccess={() => {
                  setIsFormOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['contacts'] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ImportCSVModal open={isImportOpen} onOpenChange={setIsImportOpen} />
      <ContactFieldsManager open={isFieldsOpen} onOpenChange={setIsFieldsOpen} />

      <div className="flex gap-1 mb-4 border-b border-[#dde3ec]">
        {(['interessado', 'cliente'] as const).map(type => (
          <button
            key={type}
            onClick={() => setContactTypeTab(type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              contactTypeTab === type
                ? 'border-[#0A2540] text-[#0A2540]'
                : 'border-transparent text-[#6b7e9a] hover:text-[#0A2540]'
            }`}
          >
            {type === 'interessado' ? 'Interessados' : 'Clientes'}
          </button>
        ))}
      </div>

      <Card data-tour="contacts-filters" className="mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Pesquisar por nome, telefone, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 w-full"
          />
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado do Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {pipelineStages.map((s) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={revenueFilter}
            onValueChange={setRevenueFilter}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Faturamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="- 50 Milhões De Kwanzas">- 50M = 50 Milhões</SelectItem>
              <SelectItem value="Entre 50 - 100 Milhões">50M - 100M Milhões</SelectItem>
              <SelectItem value="Entre 100 Milhões - 500 Milhões">100M - 500M Milhões</SelectItem>
              <SelectItem value="+ 500 M">+500M Milhões</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card data-tour="contacts-table">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                {visibleSystemCols.map(cfg => (
                  <TableHead key={cfg.fieldKey} className="hidden md:table-cell">{cfg.label}</TableHead>
                ))}
                {fieldDefs.map((f) => (
                  <TableHead key={f.id} className="hidden lg:table-cell">{f.label}</TableHead>
                ))}
                <TableHead>Stage</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell className="hidden sm:table-cell">{contact.phone || '-'}</TableCell>
                {visibleSystemCols.map(cfg => (
                  <TableCell key={cfg.fieldKey} className="hidden md:table-cell text-sm">
                    {cfg.fieldKey === 'tags'
                      ? ((contact.tags ?? []).join(', ') || '-')
                      : ((contact as any)[cfg.fieldKey] || '-')}
                  </TableCell>
                ))}
                {fieldDefs.map((f) => (
                  <TableCell key={f.id} className="hidden lg:table-cell text-sm">
                    {contact.customFields?.[f.key] || '-'}
                  </TableCell>
                ))}
                <TableCell>
                  <Badge
                    style={{
                      background: (pipelineStages.find((s) => s.name === contact.stage)?.color ?? '#6B7280') + '22',
                      color: pipelineStages.find((s) => s.name === contact.stage)?.color ?? '#6B7280',
                      border: 'none',
                    }}
                  >
                    {contact.stage}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link href={`/contacts/${contact.id}`}>
                      <Button variant="outline" size="sm">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </Link>
                    {(() => {
                      const waNum = formatWA(contact.phone ?? '');
                      return waNum ? (
                        <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" title="WhatsApp">
                            <Phone className="w-4 h-4" />
                          </Button>
                        </a>
                      ) : (
                        <Button variant="outline" size="sm" disabled className="opacity-40" title="Sem telefone">
                          <Phone className="w-4 h-4" />
                        </Button>
                      );
                    })()}
                    {contactTypeTab === 'interessado' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        title="Converter para Cliente"
                        onClick={() => updateContact(String(contact.id), { contactType: 'cliente' } as any).then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }))}
                      >
                        → Cliente
                      </Button>
                    )}
                    {!currentUser?.accountOwnerId && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(contact.id.toString())}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
