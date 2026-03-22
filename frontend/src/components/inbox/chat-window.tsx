'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages, sendMessage, sendEmailMessage, getWhatsAppTemplates, getContact } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Contact, WhatsAppTemplate } from '@/lib/types';
import { MessageCircle, MailIcon, FileText } from 'lucide-react';

type Mode = 'text' | 'template' | 'email';

export default function ChatWindow({ contactId, defaultMode }: { contactId: string; defaultMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(defaultMode ?? 'text');
  const [messageText, setMessageText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', contactId],
    queryFn: () => getMessages(contactId),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => getContact(contactId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => getWhatsAppTemplates(),
  });

  const approvedTemplates = templates.filter((t) => t.status === 'APPROVED');

  const sendMutation = useMutation({
    mutationFn: async (data: { text?: string; templateName?: string }) => {
      try {
        const response = await sendMessage(contactId, data.text, data.templateName);
        // Check if response has a warning (207 status means saved but delivery failed)
        if (response?.warning) {
          setWarningMsg(`Mensagem guardada mas não entregue: ${response.warning}`);
        } else {
          setWarningMsg(null);
        }
        return response;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      setMessageText('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['messages', contactId] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Erro ao enviar mensagem';
      setErrorMsg(message);
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const response = await sendEmailMessage(contactId, emailSubject, emailBody);
      if (response?.warning) {
        setWarningMsg(`Mensagem guardada mas não entregue: ${response.warning}`);
      } else {
        setWarningMsg(null);
      }
      return response;
    },
    onSuccess: () => {
      setEmailSubject('');
      setEmailBody('');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['messages', contactId] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Erro ao enviar email';
      setErrorMsg(message);
    },
  });

  const handleSendText = () => {
    if (messageText.trim()) {
      sendMutation.mutate({ text: messageText });
    }
  };

  const handleSendTemplate = (templateName: string) => {
    sendMutation.mutate({ templateName });
  };

  const handleSendEmail = () => {
    if (emailSubject.trim() && emailBody.trim()) {
      emailMutation.mutate();
    }
  };

  return (
    <Card className="h-full flex flex-col bg-slate-50 border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900">Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-lg ${
                  msg.direction === 'outbound'
                    ? 'bg-purple-600/80 text-white'
                    : 'bg-[#f5f7fa] text-[#0A2540]'
                }`}
              >
                {msg.channel === 'email' && (
                  <p className="text-xs mb-1 flex items-center gap-1">
                    <MailIcon className="w-3 h-3" /> {msg.subject}
                  </p>
                )}
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200">
          <button
            onClick={() => {
              setMode('text');
              setErrorMsg(null);
              setWarningMsg(null);
            }}
            className={`flex items-center gap-1 px-3 py-2 text-sm ${
              mode === 'text'
                ? 'border-b-2 border-[#0A2540] text-[#0A2540]'
                : 'text-slate-400 hover:text-slate-500'
            }`}
          >
            <MessageCircle className="w-4 h-4" /> Texto
          </button>
          <button
            onClick={() => {
              setMode('template');
              setErrorMsg(null);
              setWarningMsg(null);
            }}
            className={`flex items-center gap-1 px-3 py-2 text-sm ${
              mode === 'template'
                ? 'border-b-2 border-[#0A2540] text-[#0A2540]'
                : 'text-slate-400 hover:text-slate-500'
            }`}
          >
            <FileText className="w-4 h-4" /> Template
          </button>
          <button
            onClick={() => {
              setMode('email');
              setErrorMsg(null);
              setWarningMsg(null);
            }}
            disabled={!contact?.email}
            className={`flex items-center gap-1 px-3 py-2 text-sm ${
              mode === 'email'
                ? 'border-b-2 border-[#0A2540] text-[#0A2540]'
                : contact?.email
                ? 'text-slate-400 hover:text-slate-500'
                : 'text-zinc-700 cursor-not-allowed'
            }`}
          >
            <MailIcon className="w-4 h-4" /> Email
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
            </div>
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Warning Banner */}
        {warningMsg && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
            </div>
            <p className="text-sm text-amber-300">{warningMsg}</p>
          </div>
        )}

        {/* Compose Area */}
        {mode === 'text' && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Escrever mensagem..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 max-h-20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
            />
            <Button
              onClick={handleSendText}
              disabled={sendMutation.isPending || !messageText.trim()}
            >
              Enviar
            </Button>
          </div>
        )}

        {mode === 'template' && (
          <div className="space-y-3">
            {approvedTemplates.length === 0 ? (
              <p className="text-sm text-slate-400">Sem templates disponíveis</p>
            ) : (
              <>
                <p className="text-xs text-slate-500">Selecione um template:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-24 overflow-y-auto">
                  {approvedTemplates.map((template) => (
                    <Button
                      key={template.name}
                      onClick={() => handleSendTemplate(template.name)}
                      disabled={sendMutation.isPending}
                      variant="outline"
                      className="text-xs h-auto py-2 text-left justify-start"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs opacity-70">{template.language}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'email' && contact?.email && (
          <div className="space-y-2">
            <Input
              placeholder="Assunto do email..."
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <Textarea
              placeholder="Corpo do email..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="max-h-20"
            />
            <Button
              onClick={handleSendEmail}
              disabled={emailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
              className="w-full"
            >
              Enviar Email
            </Button>
            <p className="text-xs text-slate-400">Para: {contact.email}</p>
          </div>
        )}

        {mode === 'email' && !contact?.email && (
          <p className="text-sm text-slate-400">Contacto sem email configurado</p>
        )}
      </CardContent>
    </Card>
  );
}
