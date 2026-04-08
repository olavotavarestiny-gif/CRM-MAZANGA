import { getPasswordRequirementStatus } from '@/lib/password-policy';

type PasswordRequirementsProps = {
  password: string;
  className?: string;
};

export function PasswordRequirements({ password, className = '' }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirementStatus(password);

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className}`.trim()}>
      <p className="text-xs font-medium text-slate-700">A password deve incluir:</p>
      <ul className="mt-2 space-y-1 text-xs">
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className={requirement.met ? 'text-emerald-700' : 'text-slate-600'}
          >
            {requirement.met ? '✓' : '•'} {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
