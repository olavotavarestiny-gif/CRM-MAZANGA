'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getCurrentUser,
} from '@/lib/api';
import type { User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import AutomationForm from '@/components/automations/automation-form';
import { Trash2 } from 'lucide-react';

export default function AutomationsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: automations = [] } = useQuery({
    queryKey: ['automations'],
    queryFn: () => getAutomations(),
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { id: string; active: boolean }) =>
      updateAutomation(params.id, { active: params.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Automações</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>Nova Automação</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Automação</DialogTitle>
            </DialogHeader>
            <AutomationForm
              onSuccess={() => {
                setIsFormOpen(false);
                queryClient.invalidateQueries({ queryKey: ['automations'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trigger</TableHead>
                <TableHead className="hidden sm:table-cell">Condição</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead className="hidden md:table-cell">Detalhe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {automations.map((automation) => (
              <TableRow key={automation.id}>
                <TableCell className="text-sm">{automation.trigger}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-gray-500">
                  {automation.triggerValue || '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {automation.action === 'update_stage'
                    ? `→ ${automation.targetStage}`
                    : automation.action}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs">
                  {automation.action === 'send_email'
                    ? automation.emailSubject
                    : automation.action === 'update_stage'
                    ? `Mover para ${automation.targetStage}`
                    : automation.templateName}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={automation.active}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({
                        id: automation.id,
                        active: checked,
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  {!currentUser?.accountOwnerId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(automation.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
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
