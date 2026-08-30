'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManagementFormDialog from '@/components/management/management-form-dialog';
import { ManagementLoading, ManagementPage, StatusBadge, tdClass, thClass, tableClass } from '@/components/management/management-ui';
import { managementApi, type ManagementProfile, type ManagementRole } from '@/lib/management-api';
import { formatDate } from '@/lib/management-format';
import { useToast } from '@/components/ui/toast-provider';

const roleOptions=[['marketing','Marketing'],['commercial','Comercial'],['designer','Designer'],['editor','Editor']].map(([value,label])=>({value,label}));
export default function UsersPage(){
  const qc=useQueryClient();const {toast}=useToast();const [open,setOpen]=useState(false);const [editing,setEditing]=useState<ManagementProfile|null>(null);const query=useQuery({queryKey:['management-users'],queryFn:managementApi.listUsers});
  const create=useMutation({mutationFn:(values:Record<string,unknown>)=>managementApi.createUser(values as {name:string;email:string;password:string;role:Exclude<ManagementRole,'admin'>}),onSuccess:()=>{qc.invalidateQueries({queryKey:['management-users']});setOpen(false);toast({title:'Utilizador criado',description:'A mudança de password será obrigatória no primeiro acesso.',variant:'success'});}});
  const update=useMutation({mutationFn:(values:Record<string,unknown>)=>managementApi.updateUser(editing!.id,{fullName:String(values.fullName),role:values.role as ManagementRole,active:Boolean(values.active)}),onSuccess:()=>{qc.invalidateQueries({queryKey:['management-users']});setOpen(false);setEditing(null);toast({title:'Utilizador atualizado',variant:'success'});}});
  const createFields=[{name:'name',label:'Nome',required:true},{name:'email',label:'E-mail',type:'email' as const,required:true},{name:'password',label:'Password temporária',type:'text' as const,required:true},{name:'role',label:'Função',type:'select' as const,required:true,options:roleOptions}];const editFields=[{name:'fullName',label:'Nome',required:true},{name:'role',label:'Função',type:'select' as const,required:true,options:[{value:'admin',label:'Administrador'},...roleOptions]},{name:'active',label:'Utilizador ativo',type:'checkbox' as const}];
  if(query.isLoading)return <ManagementLoading/>;return <ManagementPage title="Utilizadores" description="Equipa, funções e acesso ao workspace." action={<Button onClick={()=>{setEditing(null);setOpen(true)}}><Plus className="mr-2 h-4 w-4"/>Novo utilizador</Button>}>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className={tableClass}><thead><tr>{['Utilizador','E-mail','Função','Estado','Última atividade','Ações'].map((label)=><th key={label} className={thClass}>{label}</th>)}</tr></thead><tbody>{query.data?.map((profile)=><tr key={profile.id}><td className={tdClass}>{profile.fullName}</td><td className={tdClass}>{profile.user?.email||'—'}</td><td className={tdClass}>{profile.role}</td><td className={tdClass}><StatusBadge value={profile.active?'ativo':'inativo'}/></td><td className={tdClass}>{formatDate(profile.user?.lastSeenAt)}</td><td className={tdClass}><Button variant="ghost" size="sm" onClick={()=>{setEditing(profile);setOpen(true)}}>Editar</Button></td></tr>)}</tbody></table></div>
    <ManagementFormDialog open={open} onOpenChange={setOpen} title={editing?'Editar utilizador':'Novo utilizador'} fields={editing?editFields:createFields} initialValues={editing?{fullName:editing.fullName,role:editing.role,active:editing.active}:{role:'commercial'}} isEditing={Boolean(editing)} submitting={create.isPending||update.isPending} onSubmit={(values)=>editing?update.mutateAsync(values):create.mutateAsync(values)}/>
  </ManagementPage>;
}
