import { redirect } from 'next/navigation';

export default function PipelineAnalyticsRedirectPage() {
  redirect('/pipeline?tab=analytics');
}
