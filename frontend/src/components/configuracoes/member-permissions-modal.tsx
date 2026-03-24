'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PAGE_KEYS } from '@/lib/page-keys';
import { setMemberPages } from '@/lib/api';
import type { User } from '@/lib/api';

interface Props {
  member: User;
  orgAllowedPages: string[] | null; // pages allowed at org level (null = all)
  onClose: () => void;
  onSaved: () => void;
}

export default function MemberPermissionsModal({ member, orgAllowedPages, onClose, onSaved }: Props) {
  const availablePages = orgAllowedPages
    ? PAGE_KEYS.filter(p => orgAllowedPages.includes(p.key))
    : [...PAGE_KEYS];

  const [selected, setSelected] = useState<string[]>(
    member.allowedPages ?? availablePages.map(p => p.key)
  );

  const mutation = useMutation({
    mutationFn: () => {
      const hasAll = selected.length === availablePages.length;
      return setMemberPages(member.id, hasAll ? null : selected);
    },
    onSuccess: () => { onSaved(); onClose(); },
  });

  const toggle = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelected(availablePages.map(p => p.key));
  const clearAll = () => setSelected([]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões — {member.name}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-500">Selecciona as páginas que {member.name} pode aceder:</p>

          <div className="grid grid-cols-2 gap-2">
            {availablePages.map(page => (
              <label key={page.key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={selected.includes(page.key)}
                  onChange={() => toggle(page.key)}
                  className="w-4 h-4 accent-[#0A2540]"
                />
                <span className="text-sm text-gray-800">{page.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-[#0A2540] hover:underline">
              Seleccionar Tudo
            </button>
            <span className="text-gray-300">·</span>
            <button onClick={clearAll} className="text-xs text-gray-400 hover:underline">
              Limpar Tudo
            </button>
          </div>

          {orgAllowedPages && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
              As restrições da vossa organização aplicam-se primeiro. Páginas não disponíveis na vossa conta não podem ser desbloqueadas aqui.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selected.length === 0}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
          >
            {mutation.isPending ? 'A guardar...' : 'Guardar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
