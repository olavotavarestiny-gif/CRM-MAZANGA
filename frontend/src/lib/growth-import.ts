import type { GrowthCampaign, GrowthContactSource } from './growth-api';

export type GrowthImportResult = {
  sources: GrowthContactSource[];
  campaigns: GrowthCampaign[];
  totals: { contacts:number; qualifiedContacts:number; meetings:number; proposals:number; sales:number; attributedRevenue:number; investment:number };
};

const aliases:Record<string,string[]> = {
  sourceName:['origem','fonte','canal','source','source name'], campaignName:['campanha','campaign','nome da campanha'],
  contacts:['contactos','contatos','leads','contacts'], qualifiedContacts:['qualificados','contactos qualificados','leads qualificados','qualified contacts'],
  meetings:['reunioes','reunioes marcadas','meetings'], proposals:['propostas','proposals'], sales:['vendas','sales'],
  revenue:['receita','receita atribuida','faturacao','revenue'], investment:['investimento','valor investido','spend','investment'], objective:['objetivo','objective'],
};

const normalize=(value:unknown)=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ');
const numberValue=(value:unknown)=>{if(typeof value==='number')return Number.isFinite(value)?value:0;let text=String(value??'').replace(/kz|aoa/gi,'').replace(/\s/g,'');if(!text)return 0;if(text.includes(',')){text=text.replace(/\./g,'').replace(',','.')}else if(/^\d{1,3}(\.\d{3})+$/.test(text)){text=text.replace(/\./g,'')}const parsed=Number(text);return Number.isFinite(parsed)&&parsed>=0?parsed:0};
const integerValue=(value:unknown)=>Math.round(numberValue(value));
const get=(row:Record<string,unknown>,field:string)=>{const keys=Object.keys(row);const match=keys.find((key)=>aliases[field]?.includes(normalize(key)));return match?row[match]:undefined};
const quality=(contacts:number,qualified:number):GrowthContactSource['qualityLabel']=>{const rate=contacts>0?qualified/contacts:0;return rate>=.6?'very_high':rate>=.4?'high':rate>=.2?'medium':'low'};

export function mapGrowthImportRows(rows:Record<string,unknown>[]):GrowthImportResult {
  const sources:GrowthContactSource[]=[];const campaigns:GrowthCampaign[]=[];
  rows.slice(0,500).forEach((row,index)=>{
    const sourceName=String(get(row,'sourceName')??'').trim();const campaignName=String(get(row,'campaignName')??'').trim();
    const contacts=integerValue(get(row,'contacts'));const qualifiedContacts=integerValue(get(row,'qualifiedContacts'));const meetings=integerValue(get(row,'meetings'));const proposals=integerValue(get(row,'proposals'));const sales=integerValue(get(row,'sales'));const revenue=numberValue(get(row,'revenue'));const investment=numberValue(get(row,'investment'));
    if(sourceName)sources.push({sourceName,contacts,qualifiedContacts,meetings,proposals,sales,revenue,qualityLabel:quality(contacts,qualifiedContacts),strategicReading:'',sortOrder:index});
    if(campaignName)campaigns.push({name:campaignName,objective:String(get(row,'objective')??'').trim(),sourceName,investment,contacts,sales,revenue,status:'testing',decision:'',note:'',sortOrder:index});
  });
  const sum=<T,>(list:T[],key:keyof T)=>list.reduce((total,row)=>total+Number(row[key]||0),0);
  return {sources,campaigns,totals:{contacts:sum(sources,'contacts'),qualifiedContacts:sum(sources,'qualifiedContacts'),meetings:sum(sources,'meetings'),proposals:sum(sources,'proposals'),sales:sum(sources,'sales'),attributedRevenue:sum(sources,'revenue'),investment:sum(campaigns,'investment')}};
}
