'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, Camera, CheckCircle2, CircleAlert, Clock3, KeyRound, LogOut, MapPin, MessageCircle, Navigation, PackageCheck, Phone, Save, Upload, WalletCards, WifiOff } from 'lucide-react';
import { configureOwnFoodStaffPin, confirmFoodDeliveryCollection, endFoodShift, getCurrentFoodWorkforce, getFoodContext, getFoodDeliveries, getFoodSettings, getOwnFoodCourierProfile, handoffFoodDeliveryCollection, registerFoodDeliveryProof, requestFoodDeliveryContact, startFoodShift, transitionFoodDelivery, updateOwnFoodCourierProfile, updateOwnFoodCourierStatus } from '@/lib/api';
import type { FoodDelivery, FoodDeliveryState } from '@/lib/types';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useFoodRealtime } from '@/hooks/use-food-realtime';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';

const STATE_LABELS: Partial<Record<FoodDeliveryState, string>> = {
  assigned: 'Nova tarefa', approaching_pickup: 'A caminho da recolha', picked_up: 'Pedido recolhido', out_for_delivery: 'Em entrega', arrived: 'No destino', delivered: 'Entregue', failed: 'Com problema', returned: 'Devolvido',
};

const OPERATIONAL_LABELS: Record<string, string> = {
  available: 'Disponível', unavailable: 'Indisponível', off_shift: 'Fora do turno', assigned: 'Atribuído', heading_pickup: 'A recolher', at_restaurant: 'No restaurante', delivering: 'Em entrega', no_gps: 'Sem GPS', problem: 'Com problema',
};

function nextAction(state: FoodDeliveryState) {
  if (state === 'assigned') return { state: 'approaching_pickup' as const, label: 'Ir recolher', icon: Navigation };
  if (state === 'approaching_pickup') return { state: 'picked_up' as const, label: 'Confirmar recolha', icon: PackageCheck };
  if (state === 'picked_up') return { state: 'out_for_delivery' as const, label: 'Sair para entrega', icon: Bike };
  if (state === 'out_for_delivery') return { state: 'arrived' as const, label: 'Cheguei ao destino', icon: MapPin };
  return null;
}

export default function FoodCourierPage() {
  const queryClient = useQueryClient();
  useFoodRealtime();
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error: uploadError } = useFileUpload();
  const [proofDelivery, setProofDelivery] = useState<FoodDelivery | null>(null);
  const [pin, setPin] = useState('');
  const [proofMediaId, setProofMediaId] = useState<string | null>(null);
  const [incident, setIncident] = useState<FoodDelivery | null>(null);
  const [collectionIssue, setCollectionIssue] = useState<FoodDelivery | null>(null);
  const [reason, setReason] = useState('');
  const [branchId, setBranchId] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [collectionMethod, setCollectionMethod] = useState<Record<string, string>>({});
  const [profileForm, setProfileForm] = useState({ phone: '', address: '', transportType: 'motorcycle', vehiclePlate: '' });
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const profileQuery = useQuery({ queryKey: ['food-courier-profile'], queryFn: getOwnFoodCourierProfile, refetchInterval: 10_000 });
  const workforceQuery = useQuery({ queryKey: ['food-workforce-current', branchId], queryFn: () => getCurrentFoodWorkforce(branchId), enabled: Boolean(branchId), refetchInterval: 10_000 });
  const deliveriesQuery = useQuery({ queryKey: ['food-courier-deliveries'], queryFn: () => getFoodDeliveries(), refetchInterval: 5_000 });
  const branches = contextQuery.data?.branches ?? [];

  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(profileQuery.data?.shift?.branchId || branches.find((branch) => branch.isMain)?.id || branches[0].id);
  }, [branchId, branches, profileQuery.data?.shift?.branchId]);
  useEffect(() => {
    const profile = profileQuery.data?.profile;
    if (!profile) return;
    setProfileForm({ phone: profile.phone || '', address: profile.address || '', transportType: profile.transportType || 'motorcycle', vehiclePlate: profile.vehiclePlate || '' });
  }, [profileQuery.data?.profile]);
  useEffect(() => {
    const key = 'kukugest-food-device-id';
    const existing = window.localStorage.getItem(key);
    const value = existing || globalThis.crypto?.randomUUID?.() || `food-device-${Date.now()}`;
    if (!existing) window.localStorage.setItem(key, value);
    setDeviceId(value);
  }, []);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-courier-deliveries'] }),
      queryClient.invalidateQueries({ queryKey: ['food-deliveries'] }),
      queryClient.invalidateQueries({ queryKey: ['food-courier-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['food-workforce-current'] }),
      queryClient.invalidateQueries({ queryKey: ['food-couriers'] }),
    ]);
  };
  const credentialMutation = useMutation({ mutationFn: () => configureOwnFoodStaffPin(newPin), onSuccess: async () => { setNewPin(''); setNewPinConfirm(''); await refresh(); } });
  const startShiftMutation = useMutation({ mutationFn: () => startFoodShift({ branchId, pin: staffPin, deviceId }), onSuccess: async () => { setStaffPin(''); await refresh(); } });
  const endShiftMutation = useMutation({ mutationFn: () => endFoodShift(profileQuery.data!.shift!.id, { pin: staffPin, deviceId }), onSuccess: async () => { setStaffPin(''); await refresh(); } });
  const profileMutation = useMutation({ mutationFn: () => updateOwnFoodCourierProfile(profileForm), onSuccess: refresh });
  const statusMutation = useMutation({ mutationFn: (status: 'available' | 'unavailable' | 'no_gps') => updateOwnFoodCourierStatus({ status }), onSuccess: refresh });
  const contactMutation = useMutation({
    mutationFn: ({ deliveryId, channel }: { deliveryId: string; channel: 'phone' | 'whatsapp' }) => requestFoodDeliveryContact(deliveryId, channel),
    onSuccess: (action) => { window.location.href = action.uri; },
  });
  const transitionMutation = useMutation({
    mutationFn: ({ delivery, state, transitionReason }: { delivery: FoodDelivery; state: FoodDeliveryState; transitionReason?: string }) => transitionFoodDelivery(delivery.id, state, { reason: transitionReason }),
    onSuccess: async () => {
      setIncident(null);
      setReason('');
      await refresh();
    },
  });
  const deliverMutation = useMutation({
    mutationFn: () => transitionFoodDelivery(proofDelivery!.id, 'delivered', { pin: pin || undefined, proofMediaId: proofMediaId || undefined }),
    onSuccess: async () => {
      setProofDelivery(null);
      setPin('');
      setProofMediaId(null);
      await refresh();
    },
  });
  const collectionMutation = useMutation({
    mutationFn: ({ delivery, received }: { delivery: FoodDelivery; received: boolean }) => confirmFoodDeliveryCollection(delivery.id, received
      ? { received: true, method: collectionMethod[delivery.id] || delivery.collection?.expectedMethod || settingsQuery.data?.paymentMethods[0] }
      : { received: false, reason: reason.trim() }),
    onSuccess: async () => { setCollectionIssue(null); setReason(''); await refresh(); },
  });
  const handoffMutation = useMutation({ mutationFn: (delivery: FoodDelivery) => handoffFoodDeliveryCollection(delivery.id), onSuccess: refresh });

  const active = useMemo(() => (deliveriesQuery.data ?? []).filter((delivery) => !['delivered', 'returned'].includes(delivery.state)), [deliveriesQuery.data]);
  const completed = useMemo(() => (deliveriesQuery.data ?? []).filter((delivery) => ['delivered', 'returned'].includes(delivery.state)), [deliveriesQuery.data]);

  const uploadProof = async (file?: File) => {
    if (!file) return;
    const result = await upload(file, 'food-proof');
    if (!result) return;
    const media = await registerFoodDeliveryProof({ storageUrl: result.url, mimeType: result.contentType, sizeBytes: result.size });
    setProofMediaId(media.id);
  };

  const pageError = deliveriesQuery.error || profileQuery.error || contextQuery.error || workforceQuery.error;
  if (pageError) {
    return <div className="mx-auto max-w-3xl p-4"><ErrorState title="Não foi possível carregar as entregas" message={getApiErrorMessage(pageError)} onRetry={() => Promise.all([deliveriesQuery.refetch(), profileQuery.refetch(), contextQuery.refetch(), workforceQuery.refetch()])} /></div>;
  }

  const snapshot = profileQuery.data;
  const shift = snapshot?.shift || workforceQuery.data?.shift;
  const credentialConfigured = workforceQuery.data?.credentialConfigured;
  const operationalStatus = snapshot?.operationalStatus || 'off_shift';
  const operationalError = credentialMutation.error || startShiftMutation.error || endShiftMutation.error || profileMutation.error || statusMutation.error;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-3 pb-24 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Entregador" title="Minhas entregas" description="Actualize cada etapa no momento em que acontece." />
      <Card className="border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">Estado operacional</p><p className="mt-1 text-xs text-slate-500">{shift ? `${shift.branch?.name || 'Unidade'} · turno desde ${new Date(shift.startedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}` : 'Inicie o turno para receber novas tarefas.'}</p></div><Badge variant={operationalStatus === 'available' ? 'success' : operationalStatus === 'problem' ? 'destructive' : 'secondary'}>{OPERATIONAL_LABELS[operationalStatus] || operationalStatus}</Badge></div>
        {!credentialConfigured ? <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input type="password" inputMode="numeric" maxLength={6} placeholder="Novo código" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Input type="password" inputMode="numeric" maxLength={6} placeholder="Confirmar código" value={newPinConfirm} onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Button disabled={newPin.length < 4 || newPin !== newPinConfirm || credentialMutation.isPending} onClick={() => credentialMutation.mutate()}><KeyRound className="mr-2 h-4 w-4" />Configurar</Button></div> : <div className="mt-4 space-y-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]"><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={branchId} disabled={Boolean(shift)} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><Input type="password" inputMode="numeric" maxLength={6} placeholder="Código" value={staffPin} onChange={(event) => setStaffPin(event.target.value.replace(/\D/g, '').slice(0, 6))} />{shift ? <Button variant="outline" disabled={staffPin.length < 4 || Boolean(snapshot?.activeDelivery) || endShiftMutation.isPending} onClick={() => endShiftMutation.mutate()}><LogOut className="mr-2 h-4 w-4" />Terminar</Button> : <Button disabled={!branchId || staffPin.length < 4 || startShiftMutation.isPending} onClick={() => startShiftMutation.mutate()}><Clock3 className="mr-2 h-4 w-4" />Iniciar turno</Button>}</div>{shift ? <div className="grid grid-cols-3 gap-2"><Button variant={operationalStatus === 'available' ? 'default' : 'outline'} disabled={statusMutation.isPending || Boolean(snapshot?.activeDelivery)} onClick={() => statusMutation.mutate('available')}>Disponível</Button><Button variant={operationalStatus === 'unavailable' ? 'default' : 'outline'} disabled={statusMutation.isPending || Boolean(snapshot?.activeDelivery)} onClick={() => statusMutation.mutate('unavailable')}>Pausa</Button><Button variant={operationalStatus === 'no_gps' ? 'default' : 'outline'} disabled={statusMutation.isPending} onClick={() => statusMutation.mutate('no_gps')}><WifiOff className="mr-2 h-4 w-4" />Sem GPS</Button></div> : null}</div>}
        {operationalError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(operationalError)}</p> : null}
      </Card>
      <Card className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="font-black text-slate-950">Perfil de entrega</p><p className="mt-1 text-xs text-slate-500">Dados usados apenas na operação Delivery.</p></div><Button size="sm" disabled={profileMutation.isPending} onClick={() => profileMutation.mutate()}><Save className="mr-2 h-4 w-4" />Guardar</Button></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><Input placeholder="Telefone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /><Input placeholder="Morada" value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} /><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={profileForm.transportType} onChange={(event) => setProfileForm((current) => ({ ...current, transportType: event.target.value }))}><option value="motorcycle">Motorizada</option><option value="bicycle">Bicicleta</option><option value="car">Automóvel</option><option value="on_foot">A pé</option><option value="other">Outro</option></select><Input placeholder="Matrícula" value={profileForm.vehiclePlate} onChange={(event) => setProfileForm((current) => ({ ...current, vehiclePlate: event.target.value }))} /></div></Card>
      {deliveriesQuery.isLoading ? <div className="h-72 animate-pulse rounded-lg bg-white" /> : active.length === 0 ? <FoodEmptyState icon={Bike} title="Sem entregas atribuídas" description="Novas tarefas aparecem aqui quando o gestor fizer a atribuição." /> : (
        <div className="space-y-4">{active.map((delivery) => {
          const order = delivery.order;
          const action = nextAction(delivery.state);
          const ActionIcon = action?.icon;
          const mapQuery = encodeURIComponent([order?.deliveryAddress, order?.deliveryNeighborhood].filter(Boolean).join(', '));
          const collectionPending = delivery.collection && ['pending_collection', 'not_received'].includes(delivery.collection.state);
          const collectionReady = !delivery.collection || delivery.collection.state === 'with_courier';
          return <Card key={delivery.id} className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black text-slate-950">{order?.displayNumber || 'Entrega'}</p><p className="mt-1 text-sm font-bold text-slate-600">{order?.customerName || 'Cliente'}</p></div><Badge variant={delivery.state === 'failed' ? 'destructive' : 'default'}>{STATE_LABELS[delivery.state] || delivery.state}</Badge></div><div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="text-sm font-bold text-slate-950"><MapPin className="mr-2 inline h-4 w-4 text-[var(--workspace-primary)]" />{order?.deliveryAddress || 'Morada não indicada'}</p>{order?.deliveryReference ? <p className="mt-1 pl-6 text-xs text-slate-600">Referência: {order.deliveryReference}</p> : null}</div>{delivery.collection ? <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><div><p className="text-xs font-bold uppercase text-emerald-700">Cobrança na entrega</p><p className="text-lg font-black text-emerald-950">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: settingsQuery.data?.currency || 'AOA' }).format(delivery.collection.expectedAmount)}</p></div><WalletCards className="h-5 w-5 text-emerald-700" /></div> : null}<div className="mt-4 grid grid-cols-2 gap-2">{delivery.contactAvailable ? <><Button variant="outline" disabled={contactMutation.isPending} onClick={() => contactMutation.mutate({ deliveryId: delivery.id, channel: 'phone' })}><Phone className="mr-2 h-4 w-4" />Ligar</Button><Button variant="outline" disabled={contactMutation.isPending} onClick={() => contactMutation.mutate({ deliveryId: delivery.id, channel: 'whatsapp' })}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button></> : null}<Button asChild variant="outline" disabled={!mapQuery}><a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer"><Navigation className="mr-2 h-4 w-4" />Navegar</a></Button></div>{delivery.state === 'arrived' && collectionPending ? <div className="mt-4 space-y-2 rounded-lg border border-slate-200 p-3"><p className="text-sm font-black text-slate-950">Confirmar valor recebido</p><select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={collectionMethod[delivery.id] || delivery.collection?.expectedMethod || ''} onChange={(event) => setCollectionMethod((current) => ({ ...current, [delivery.id]: event.target.value }))}><option value="">Método de pagamento</option>{(settingsQuery.data?.paymentMethods ?? []).map((method) => <option key={method} value={method}>{method}</option>)}</select><Button className="w-full" disabled={collectionMutation.isPending || !(collectionMethod[delivery.id] || delivery.collection?.expectedMethod)} onClick={() => collectionMutation.mutate({ delivery, received: true })}><Banknote className="mr-2 h-4 w-4" />Recebi o valor indicado</Button><Button variant="outline" className="w-full" onClick={() => { setReason(''); setCollectionIssue(delivery); }}><CircleAlert className="mr-2 h-4 w-4" />Valor não recebido</Button></div> : null}<div className="mt-4 flex flex-col gap-2">{action && ActionIcon ? <Button size="lg" disabled={transitionMutation.isPending} onClick={() => transitionMutation.mutate({ delivery, state: action.state })}><ActionIcon className="mr-2 h-5 w-5" />{action.label}</Button> : null}{delivery.state === 'arrived' && collectionReady ? <Button size="lg" onClick={() => setProofDelivery(delivery)}><CheckCircle2 className="mr-2 h-5 w-5" />Confirmar entrega</Button> : null}{!['failed', 'arrived'].includes(delivery.state) ? <Button variant="outline" onClick={() => setIncident(delivery)}><CircleAlert className="mr-2 h-4 w-4" />Reportar problema</Button> : null}</div></Card>;
        })}</div>
      )}

      {completed.length > 0 ? <section><h2 className="mb-3 text-sm font-black uppercase text-slate-500">Histórico recente</h2><div className="space-y-2">{completed.slice(0, 10).map((delivery) => <div key={delivery.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"><div><p className="font-bold text-slate-950">{delivery.order?.displayNumber}</p><p className="text-xs text-slate-500">{delivery.collection?.state === 'with_courier' ? 'Valor em sua posse' : delivery.order?.customerName}</p></div>{delivery.collection?.state === 'with_courier' ? <Button size="sm" disabled={handoffMutation.isPending} onClick={() => handoffMutation.mutate(delivery)}><Banknote className="mr-2 h-4 w-4" />Entregar ao caixa</Button> : <Badge variant={delivery.state === 'delivered' ? 'success' : 'secondary'}>{STATE_LABELS[delivery.state]}</Badge>}</div>)}</div></section> : null}
      {(transitionMutation.isError || contactMutation.isError || collectionMutation.isError || handoffMutation.isError) ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(transitionMutation.error || contactMutation.error || collectionMutation.error || handoffMutation.error)}</p> : null}

      {proofDelivery ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setProofDelivery(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Prova de entrega</h2><p className="mt-1 text-sm text-slate-500">{proofDelivery.order?.paymentState === 'paid' && !proofDelivery.collection ? 'Use o PIN do cliente. A fotografia é uma alternativa autorizada.' : 'Este pedido teve cobrança local e não utiliza PIN. Anexe uma fotografia autorizada.'}</p>{proofDelivery.order?.paymentState === 'paid' && !proofDelivery.collection ? <><div className="mt-5"><Input inputMode="numeric" maxLength={6} className="h-14 text-center font-mono text-2xl font-black" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN de 6 dígitos" /></div><div className="my-4 flex items-center gap-3 text-xs font-bold uppercase text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou<span className="h-px flex-1 bg-slate-200" /></div></> : null}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => uploadProof(event.target.files?.[0])} /><Button variant="outline" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>{proofMediaId ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : uploading ? <Upload className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}{proofMediaId ? 'Fotografia anexada' : uploading ? `A carregar ${progress}%` : 'Fotografar comprovativo'}</Button>{uploadError ? <p className="mt-2 text-sm font-semibold text-red-600">{uploadError}</p> : null}{deliverMutation.isError ? <p className="mt-2 text-sm font-semibold text-red-600">{getApiErrorMessage(deliverMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setProofDelivery(null)}>Cancelar</Button><Button disabled={((proofDelivery.order?.paymentState === 'paid' && !proofDelivery.collection ? pin.length !== 6 : true) && !proofMediaId) || deliverMutation.isPending} onClick={() => deliverMutation.mutate()}>Confirmar entrega</Button></div></Card></div> : null}

      {incident ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setIncident(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Reportar problema</h2><Input className="mt-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o problema" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setIncident(null)}>Cancelar</Button><Button variant="destructive" disabled={!reason.trim() || transitionMutation.isPending} onClick={() => transitionMutation.mutate({ delivery: incident, state: 'failed', transitionReason: reason })}>Enviar ocorrência</Button></div></Card></div> : null}
      {collectionIssue ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setCollectionIssue(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Valor não recebido</h2><p className="mt-1 text-sm text-slate-500">O pedido permanece por cobrar e a ocorrência fica registada.</p><Input className="mt-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setCollectionIssue(null)}>Cancelar</Button><Button variant="destructive" disabled={reason.trim().length < 3 || collectionMutation.isPending} onClick={() => collectionMutation.mutate({ delivery: collectionIssue, received: false })}>Confirmar</Button></div></Card></div> : null}
    </div>
  );
}
