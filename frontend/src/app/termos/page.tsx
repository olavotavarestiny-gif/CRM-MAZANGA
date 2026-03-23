import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Serviço — KukuGest',
  description: 'Termos e condições de utilização da plataforma KukuGest, sistema de gestão de clientes e faturação AGT.',
};

export default function TermosPage() {
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
          <span className="text-xs text-gray-400">Termos de Serviço</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#0A2540]">Termos de Serviço</h1>
          <p className="text-gray-500 text-sm">Última actualização: 22 de Março de 2026</p>
        </div>

        <p className="text-gray-700 leading-relaxed">
          Estes Termos de Serviço regulam o acesso e utilização da plataforma <strong>KukuGest</strong>, desenvolvida e operada pela
          <strong> Mazanga Marketing Lda</strong>, com NIF 5001636863, com sede em Luanda, República de Angola.
          Ao criar uma conta ou utilizar o Serviço, aceita integralmente estes Termos.
        </p>

        {/* Secções */}
        <Section number="1" title="Aceitação dos Termos">
          <p>
            Ao aceder à plataforma KukuGest, registar uma conta ou utilizar qualquer funcionalidade do Serviço, o utilizador
            confirma ter lido, compreendido e aceite estes Termos. Se actua em nome de uma empresa, garante que tem autoridade
            para vincular essa entidade aos presentes Termos.
          </p>
          <p className="mt-3">
            Caso não concorde com alguma disposição, deve cessar imediatamente a utilização do Serviço e solicitar o encerramento da conta.
          </p>
        </Section>

        <Section number="2" title="Descrição do Serviço">
          <p>
            O KukuGest é uma plataforma SaaS (<em>Software as a Service</em>) que inclui:
          </p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
            <li>Sistema de Gestão de Clientes (CRM) — gestão de contactos, pipeline de vendas, tarefas e automações</li>
            <li>Módulo de Faturação Electrónica — emissão de facturas conformes com os requisitos da AGT (Administração Geral Tributária de Angola)</li>
            <li>Gestão Financeira — controlo de receitas, despesas e relatórios</li>
            <li>Comunicações — integração WhatsApp Business e email</li>
            <li>Formulários Web — captura de leads e submissões</li>
          </ul>
          <p className="mt-3">
            A Mazanga Marketing Lda reserva o direito de adicionar, modificar ou descontinuar funcionalidades, com aviso prévio de 30 dias quando se trate de alterações materiais.
          </p>
        </Section>

        <Section number="3" title="Registo e Conta">
          <p>Para utilizar o Serviço, é necessário criar uma conta com informações verdadeiras, precisas e actualizadas. O utilizador é responsável por:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
            <li>Manter a confidencialidade das credenciais de acesso</li>
            <li>Todas as actividades realizadas sob a sua conta</li>
            <li>Notificar imediatamente qualquer acesso não autorizado para <a href="mailto:suporte@mazanga.digital" className="text-[#635BFF] hover:underline">suporte@mazanga.digital</a></li>
          </ul>
          <p className="mt-3">
            O titular da conta (Account Owner) pode criar utilizadores adicionais dentro da sua organização. Esses utilizadores ficam sujeitos aos mesmos Termos e a responsabilidade pelas suas acções recai sobre o titular da conta.
          </p>
        </Section>

        <Section number="4" title="Planos e Pagamentos">
          <p>O KukuGest oferece os seguintes planos de subscrição:</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-[#0A2540]">Essencial</h4>
              <p className="text-2xl font-bold text-[#635BFF] mt-1">30.000 Kz<span className="text-sm font-normal text-gray-500">/mês</span></p>
              <ul className="mt-3 text-sm text-gray-600 space-y-1">
                <li>• CRM até 1.000 contactos</li>
                <li>• Faturação AGT</li>
                <li>• 1 utilizador</li>
                <li>• Suporte por email</li>
              </ul>
            </div>
            <div className="border-2 border-[#635BFF] rounded-lg p-4">
              <h4 className="font-semibold text-[#0A2540]">Profissional</h4>
              <p className="text-2xl font-bold text-[#635BFF] mt-1">50.000 Kz<span className="text-sm font-normal text-gray-500">/mês</span></p>
              <ul className="mt-3 text-sm text-gray-600 space-y-1">
                <li>• CRM ilimitado</li>
                <li>• Faturação AGT + SAF-T</li>
                <li>• Até 5 utilizadores</li>
                <li>• WhatsApp + Email</li>
                <li>• Suporte prioritário</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-gray-700">
            Os pagamentos são processados mensalmente ou anualmente, conforme acordado. O não pagamento na data de vencimento pode resultar na suspensão temporária do acesso.
            Os preços podem ser actualizados com aviso prévio de 60 dias.
          </p>
        </Section>

        <Section number="5" title="Uso Aceitável">
          <p>O utilizador compromete-se a não utilizar o Serviço para:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
            <li>Actividades ilegais ou que violem a legislação angolana</li>
            <li>Emissão de facturas com dados falsos ou fraudulentos</li>
            <li>Transmissão de malware, spam ou conteúdo prejudicial</li>
            <li>Tentativas de acesso não autorizado a sistemas de terceiros</li>
            <li>Reengenharia reversa ou cópia não autorizada do software</li>
            <li>Revenda do Serviço sem autorização prévia por escrito</li>
          </ul>
          <p className="mt-3">
            A violação destas condições pode resultar na suspensão imediata da conta, sem reembolso.
          </p>
        </Section>

        <Section number="6" title="Propriedade dos Dados">
          <p>
            O utilizador <strong>mantém a propriedade total</strong> de todos os dados inseridos na plataforma, incluindo informações de clientes, transacções e documentos fiscais.
          </p>
          <p className="mt-3">
            A Mazanga Marketing Lda não reivindica qualquer direito de propriedade sobre os dados do utilizador e não os utiliza para fins comerciais próprios.
            Em caso de cancelamento da conta, os dados podem ser exportados durante 30 dias após o encerramento, após os quais serão eliminados dos sistemas.
          </p>
        </Section>

        <Section number="7" title="Certificação AGT e Faturação Electrónica">
          <p>
            O módulo de faturação electrónica do KukuGest está desenvolvido em conformidade com os requisitos técnicos da
            <strong> Administração Geral Tributária (AGT)</strong> de Angola.
          </p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-700">
            <li>A Mazanga Marketing Lda responsabiliza-se pela manutenção da certificação do software junto da AGT</li>
            <li>O utilizador é responsável pela exactidão dos dados inseridos nas facturas</li>
            <li>A numeração sequencial e a integridade criptográfica (assinatura JWS) são garantidas pelo sistema</li>
            <li>Em caso de indisponibilidade da API da AGT, o sistema opera em modo de contingência, submetendo os documentos quando a ligação for restabelecida</li>
          </ul>
        </Section>

        <Section number="8" title="Disponibilidade do Serviço">
          <p>
            A Mazanga Marketing Lda compromete-se a manter uma disponibilidade mínima de <strong>99%</strong> mensalmente (excluindo manutenções programadas).
            As manutenções programadas serão comunicadas com antecedência mínima de 48 horas.
          </p>
          <p className="mt-3">
            Não garantimos disponibilidade ininterrupta em caso de falhas de força maior, interrupções de fornecedores de infraestrutura (Vercel, Render, Supabase) ou eventos fora do nosso controlo.
          </p>
        </Section>

        <Section number="9" title="Limitação de Responsabilidade">
          <p>
            Na máxima extensão permitida pela lei angolana, a Mazanga Marketing Lda não será responsável por danos indirectos,
            incidentais, especiais ou consequentes, incluindo perda de lucros, dados ou oportunidades de negócio.
          </p>
          <p className="mt-3">
            A responsabilidade total da Mazanga Marketing Lda perante o utilizador, em qualquer circunstância, não excederá
            o valor pago pelo utilizador nos 3 meses anteriores ao evento que originou a responsabilidade.
          </p>
        </Section>

        <Section number="10" title="Suspensão e Cancelamento">
          <p>
            O utilizador pode cancelar a sua subscrição a qualquer momento através das definições da conta ou contactando <a href="mailto:suporte@mazanga.digital" className="text-[#635BFF] hover:underline">suporte@mazanga.digital</a>.
            O cancelamento tem efeito no final do período de facturação em curso.
          </p>
          <p className="mt-3">
            A Mazanga Marketing Lda pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso prévio dependendo da gravidade da infracção.
            Em caso de encerramento por parte da Mazanga Marketing Lda sem incumprimento do utilizador, será efectuado o reembolso proporcional.
          </p>
        </Section>

        <Section number="11" title="Alterações aos Termos">
          <p>
            Reservamo-nos o direito de actualizar estes Termos periodicamente. As alterações materiais serão comunicadas por email com antecedência mínima de 30 dias.
            A continuação da utilização do Serviço após essa data constitui aceitação dos novos Termos.
          </p>
        </Section>

        <Section number="12" title="Lei Aplicável e Resolução de Litígios">
          <p>
            Estes Termos são regidos pela legislação da <strong>República de Angola</strong>. Qualquer litígio será submetido à
            jurisdição exclusiva dos Tribunais de <strong>Luanda</strong>, sem prejuízo do direito de qualquer das partes recorrer
            a meios alternativos de resolução de conflitos.
          </p>
        </Section>

        <Section number="13" title="Contactos">
          <div className="space-y-2 text-gray-700">
            <p><strong>Mazanga Marketing Lda</strong></p>
            <p>NIF: 5001636863</p>
            <p>Luanda, República de Angola</p>
            <p>Email geral: <a href="mailto:suporte@mazanga.digital" className="text-[#635BFF] hover:underline">suporte@mazanga.digital</a></p>
            <p>Privacidade: <a href="mailto:privacidade@mazanga.digital" className="text-[#635BFF] hover:underline">privacidade@mazanga.digital</a></p>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>© 2026 KukuGest · Mazanga Marketing Lda</span>
          <div className="flex gap-6">
            <Link href="/privacidade" className="hover:text-[#0A2540] transition-colors">Política de Privacidade</Link>
            <a href="mailto:suporte@mazanga.digital" className="hover:text-[#0A2540] transition-colors">Suporte</a>
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
