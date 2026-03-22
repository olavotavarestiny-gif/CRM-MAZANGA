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
import { Trash2, MessageCircle, Upload, Settings2 } from 'lucide-react';
import { getContactFieldDefs } from '@/lib/api';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [revenueFilter, setRevenueFilter] = useState<string>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
  });

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', search, stageFilter, revenueFilter],
    queryFn: () =>
      getContacts({
        search: search || undefined,
        stage: stageFilter === 'ALL' ? undefined : stageFilter,
        revenue: revenueFilter === 'ALL' ? undefined : revenueFilter,
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
              <Button className="w-full sm:w-auto">Novo Contacto</Button>
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

      <Card className="mb-6">
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

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Empresa</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Setor</TableHead>
                <TableHead className="hidden md:table-cell">Faturamento</TableHead>
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
                <TableCell className="hidden sm:table-cell">{contact.company}</TableCell>
                <TableCell className="hidden sm:table-cell">{contact.phone}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{contact.sector || '-'}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{contact.revenue || '-'}</TableCell>
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
