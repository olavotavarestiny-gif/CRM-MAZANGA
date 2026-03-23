import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade — KukuGest',
  description: 'Como a KukuGest recolhe, utiliza e protege os seus dados pessoais, em conformidade com a Lei 22/11 de Angola.',
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0A2540] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Link>
          <span className="text-lg font-bold text-[#0A2540]">KukuGest</span>
          <span className="text-xs text-gray-400">Política de Privacidade</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#0A2540]">Política de Privacidade</h1>
          <p className="text-gray-500 text-sm">Última actualização: 22 de Março de 2026</p>
        </div>

        <Section number="1" title="Introdução">
          <p>
            A <strong>Mazanga Marketing Lda</strong> (&ldquo;nós&rdquo;, &ldquo;nosso&rdquo; ou &ldquo;KukuGest&rdquo;) está comprometida com a protecção da
            privacidade e dos dados pessoais dos seus utilizadores. Esta Política de Privacidade descreve como recolhemos,
            utilizamos, partilhamos e protegemos os seus dados, em conformidade com a <strong>Lei n.º 22/11 de 17 de Junho</strong> —
            Lei de Protecção de Dados Pessoais da República de Angola.
          </p>
          <p className="mt-3">
            Ao utilizar a plataforma KukuGest, aceita as práticas descritas nesta Política. Se não concordar, deverá
            cessar a utilização e contactar-nos para eliminar os seus dados.
          </p>
        </Section>

        <Section number="2" title="Dados que Recolhemos">
          <h3 className="font-semibold text-[#0A2540] mt-2">2.1 Dados fornecidos directamente</h3>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
            <li>Nome completo e endereço de email (registo e autenticação)</li>
            <li>Dados da empresa (nome, NIF, morada, logotipo)</li>
            <li>Informações de contactos e clientes inseridos no CRM</li>
            <li>Dados de faturação (NIF dos clientes, valores, descrições de serviços)</li>
            <li>Dados financeiros (transacções, categorias, notas)</li>
          </ul>
          <h3 className="font-semibold text-[#0A2540] mt-4">2.2 Dados recolhidos automaticamente</h3>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
            <li>Endereço IP e localização aproximada</li>
            <li>Tipo de dispositivo e sistema operativo</li>
            <li>Registos de acesso (logs) com data, hora e páginas visitadas</li>
            <li>Dados de sessão (cookies de autenticação)</li>
          </ul>
          <h3 className="font-semibold text-[#0A2540] mt-4">2.3 Dados de terceiros</h3>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
            <li>Dados do Google Calendar (se integração activada) — apenas eventos e disponibilidade</li>
            <li>Dados do WhatsApp Business (mensagens enviadas/recebidas através da plataforma)</li>
          </ul>
        </Section>

        <Section number="3" title="Como Utilizamos os Dados">
          <ul className="space-y-2 list-disc list-inside text-gray-700">
            <li><strong>Prestação do serviço:</strong> Gestão de contactos, emissão de facturas, envio de comunicações</li>
            <li><strong>Autenticação e segurança:</strong> Verificação de identidade, protecção contra acessos não autorizados</li>
            <li><strong>Conformidade fiscal:</strong> Submissão de documentos à AGT (Administração Geral Tributária de Angola)</li>
            <li><strong>Melhoria do produto:</strong> Análise de uso agregado e anónimo para melhorar funcionalidades</li>
            <li><strong>Comunicações de serviço:</strong> Notificações sobre a sua conta, actualizações importantes, facturas</li>
            <li><strong>Suporte técnico:</strong> Resolução de problemas reportados</li>
            <li><strong>Obrigações legais:</strong> Cumprimento de requisitos legais e regulatórios angolanos</li>
          </ul>
          <p className="mt-3">
            <strong>Não utilizamos</strong> os seus dados para publicidade de terceiros nem os vendemos a entidades externas.
          </p>
        </Section>

        <Section number="4" title="Partilha de Dados">
          <p>Os seus dados podem ser partilhados com os seguintes prestadores de serviços, estritamente necessários para o funcionamento da plataforma:</p>
          <div className="mt-4 space-y-3">
            {[
              { name: 'Vercel', role: 'Hospedagem do frontend (Next.js)', country: 'EUA' },
              { name: 'Render', role: 'Hospedagem do backend (Node.js)', country: 'Alemanha (Frankfurt)' },
              { name: 'Supabase / Render PostgreSQL', role: 'Base de dados', country: 'Alemanha (Frankfurt)' },
              { name: 'AGT — Administração Geral Tributária', role: 'Submissão de facturas electrónicas', country: 'Angola' },
              { name: 'Meta (WhatsApp Business API)', role: 'Envio de mensagens WhatsApp', country: 'EUA' },
              { name: 'Hostinger SMTP', role: 'Envio de emails transaccionais', country: 'Europa' },
            ].map(p => (
              <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div>
                  <p className="font-medium text-[#0A2540] text-sm">{p.name}</p>
                  <p className="text-gray-600 text-sm">{p.role} · <span className="text-gray-400">{p.country}</span></p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-gray-700">
            Todos os prestadores estão vinculados contratualmente a processar os dados apenas para os fins especificados e a
            implementar medidas de segurança adequadas.
          </p>
          <p className="mt-3 text-gray-700">
            Podemos também partilhar dados quando exigido por ordem judicial ou autoridade competente angolana.
          </p>
        </Section>

        <Section number="5" title="Segurança dos Dados">
          <p>Implementamos medidas de segurança técnicas e organizacionais, incluindo:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
            <li>Transmissão encriptada via <strong>SSL/TLS 1.3</strong> em todas as comunicações</li>
            <li>Armazenamento de passwords com hash <strong>bcrypt</strong> (nunca em texto simples)</li>
            <li>Autenticação via tokens <strong>JWT</strong> com expiração</li>
            <li>Base de dados com encriptação em repouso (<strong>AES-256</strong>)</li>
            <li>Backups automáticos diários com retenção de 7 dias</li>
            <li>Acesso à base de dados restrito por IP e credenciais</li>
            <li>Registo de tentativas de login e eventos de segurança</li>
          </ul>
          <p className="mt-3 text-gray-700">
            Em caso de violação de dados que afecte os seus direitos, notificaremos os utilizadores afectados no prazo de <strong>72 horas</strong> após tomar conhecimento.
          </p>
        </Section>

        <Section number="6" title="Retenção de Dados">
          <div className="space-y-3 text-gray-700">
            <div className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div>
                <p className="font-medium text-[#0A2540] text-sm">Dados da conta e CRM</p>
                <p className="text-sm">Mantidos enquanto a conta estiver activa + <strong>90 dias</strong> após cancelamento (período de recuperação)</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div>
                <p className="font-medium text-[#0A2540] text-sm">Documentos de faturação</p>
                <p className="text-sm">Mantidos por <strong>5 anos</strong> após emissão, conforme obrigação fiscal angolana (artigo 99.º do CIRC)</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div>
                <p className="font-medium text-[#0A2540] text-sm">Logs de acesso e segurança</p>
                <p className="text-sm">Mantidos por <strong>90 dias</strong></p>
              </div>
            </div>
          </div>
        </Section>

        <Section number="7" title="Os Seus Direitos">
          <p>Em conformidade com a Lei 22/11 de Angola, tem os seguintes direitos:</p>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {[
              { right: 'Acesso', desc: 'Obter cópia de todos os dados que temos sobre si' },
              { right: 'Rectificação', desc: 'Corrigir dados inexactos ou incompletos' },
              { right: 'Eliminação', desc: 'Solicitar apagamento dos seus dados (salvo obrigações legais)' },
              { right: 'Portabilidade', desc: 'Receber os seus dados em formato estruturado e legível por máquina' },
              { right: 'Oposição', desc: 'Opor-se ao tratamento dos seus dados para determinadas finalidades' },
              { right: 'Limitação', desc: 'Restringir o tratamento dos seus dados em determinadas circunstâncias' },
            ].map(r => (
              <div key={r.right} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="font-medium text-[#0A2540] text-sm">{r.right}</p>
                <p className="text-gray-600 text-sm mt-0.5">{r.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-gray-700">
            Para exercer qualquer destes direitos, contacte <a href="mailto:privacidade@mazanga.digital" className="text-[#635BFF] hover:underline">privacidade@mazanga.digital</a>.
            Responderemos no prazo máximo de <strong>30 dias</strong>.
            Tem também o direito de apresentar queixa à autoridade supervisora competente em Angola.
          </p>
        </Section>

        <Section number="8" title="Cookies e Tecnologias Similares">
          <p>Utilizamos os seguintes tipos de cookies:</p>
          <div className="mt-3 space-y-2">
            {[
              { type: 'Essenciais', desc: 'Necessários para autenticação e funcionamento básico da plataforma. Não podem ser desactivados.', color: 'text-green-700 bg-green-50 border-green-200' },
              { type: 'Funcionais', desc: 'Recordam as suas preferências (idioma, configurações de ecrã).', color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { type: 'Analíticos', desc: 'Ajudam-nos a perceber como é utilizada a plataforma (Vercel Analytics — dados agregados e anónimos).', color: 'text-purple-700 bg-purple-50 border-purple-200' },
            ].map(c => (
              <div key={c.type} className={`p-3 rounded-lg border text-sm ${c.color}`}>
                <span className="font-semibold">{c.type}:</span> {c.desc}
              </div>
            ))}
          </div>
        </Section>

        <Section number="9" title="Menores de Idade">
          <p>
            O Serviço destina-se exclusivamente a utilizadores com <strong>18 ou mais anos</strong> de idade.
            Não recolhemos intencionalmente dados de menores. Se soubermos que recolhemos dados de um menor,
            eliminaremos esses dados imediatamente.
          </p>
        </Section>

        <Section number="10" title="Transferências Internacionais de Dados">
          <p>
            Alguns dos nossos prestadores de serviços estão localizados nos <strong>Estados Unidos da América</strong> e na <strong>Europa</strong>.
            As transferências para esses países são efectuadas com base em cláusulas contratuais-tipo ou em mecanismos de
            adequação reconhecidos, garantindo um nível de protecção equivalente ao exigido pela lei angolana.
          </p>
        </Section>

        <Section number="11" title="Alterações a Esta Política">
          <p>
            Podemos actualizar esta Política de Privacidade periodicamente. Quando efectuarmos alterações materiais,
            notificaremos por email e publicaremos a versão actualizada com nova data. A continuação da utilização do
            Serviço após a data de entrada em vigor constitui aceitação das alterações.
          </p>
        </Section>

        <Section number="12" title="Contactos e Reclamações">
          <div className="space-y-2 text-gray-700">
            <p><strong>Responsável pelo Tratamento de Dados:</strong></p>
            <p>Mazanga Marketing Lda</p>
            <p>NIF: 5001636863 · Luanda, Angola</p>
            <p>
              Email de privacidade:{' '}
              <a href="mailto:privacidade@mazanga.digital" className="text-[#635BFF] hover:underline">
                privacidade@mazanga.digital
              </a>
            </p>
          </div>
          <p className="mt-4 text-gray-700">
            Pode também apresentar queixa à autoridade supervisora de protecção de dados da República de Angola.
            Responderemos a todos os pedidos no prazo máximo de 30 dias úteis.
          </p>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>© 2026 KukuGest · Mazanga Marketing Lda</span>
          <div className="flex gap-6">
            <Link href="/termos" className="hover:text-[#0A2540] transition-colors">Termos de Serviço</Link>
            <a href="mailto:privacidade@mazanga.digital" className="hover:text-[#0A2540] transition-colors">Privacidade</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0A2540] flex items-baseline gap-2">
        <span className="text-[#635BFF] text-sm font-bold">{number}.</span>
        {title}
      </h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}
