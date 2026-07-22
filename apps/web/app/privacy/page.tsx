import type { Metadata } from 'next';
import { LegalPage } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  robots: { index: false },
};

const h2 = { fontSize: 18, margin: '32px 0 10px' };
const p = { margin: '0 0 12px' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" lastUpdated="22 de julho de 2026">
      <p style={p}>
        A Zappy, operada por <strong>[RAZÃO SOCIAL]</strong>, CNPJ{' '}
        <strong>[00.000.000/0000-00]</strong>, é controladora dos dados pessoais tratados conforme
        descrito nesta Política, em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei
        13.709/2018).
      </p>

      <h2 style={h2}>1. Quais dados coletamos</h2>
      <p style={p}>
        <strong>Da empresa Contratante e seus usuários:</strong> nome, e-mail, senha (armazenada de
        forma criptografada) e dados de pagamento — processados diretamente pelo Stripe, a Zappy
        nunca armazena número de cartão.
      </p>
      <p style={p}>
        <strong>Dos clientes finais da Contratante</strong> (pessoas que conversam com o
        assistente): nome, telefone, e-mail (quando informado), histórico de conversas e dados de
        agendamento. Esses dados são coletados em nome da Contratante, que é a controladora perante
        os próprios clientes dela — a Zappy atua como operadora nesse contexto específico.
      </p>

      <h2 style={h2}>2. Base legal e finalidade do tratamento</h2>
      <p style={p}>Tratamos dados para:</p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>
        <li>execução do contrato de prestação de serviço (Art. 7º, V, LGPD);</li>
        <li>cumprimento de obrigação legal ou regulatória (ex: fiscal);</li>
        <li>legítimo interesse, para prevenção a fraude e melhoria do serviço;</li>
        <li>consentimento do titular, quando aplicável.</li>
      </ul>

      <h2 style={h2}>3. Com quem compartilhamos dados</h2>
      <p style={p}>
        Para operar a plataforma, compartilhamos dados com os seguintes prestadores de serviço
        (subprocessadores), cada um tratando dados apenas na medida necessária à sua função, sob
        obrigações contratuais de confidencialidade:
      </p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>
        <li>
          <strong>Stripe</strong> — processamento de pagamentos;
        </li>
        <li>
          <strong>Google Gemini</strong> — processamento de linguagem natural do assistente de IA;
        </li>
        <li>
          <strong>Resend</strong> — envio de e-mails transacionais;
        </li>
        <li>
          <strong>Meta / WhatsApp Cloud API</strong> — mensageria via WhatsApp.
        </li>
      </ul>

      <h2 style={h2}>4. Retenção</h2>
      <p style={p}>
        Mantemos os dados enquanto a conta estiver ativa e pelo prazo adicional necessário para
        cumprir obrigações legais (ex: fiscais) ou defender direitos em processos, após o que são
        eliminados ou anonimizados.
      </p>

      <h2 style={h2}>5. Direitos do titular</h2>
      <p style={p}>
        Nos termos do Art. 18 da LGPD, você (ou o cliente final da Contratante) pode solicitar
        confirmação da existência de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação de dados, informação sobre compartilhamento e revogação de consentimento.
        Solicitações podem ser feitas em <strong>[email do encarregado de dados]</strong>.
      </p>

      <h2 style={h2}>6. Segurança</h2>
      <p style={p}>
        Adotamos medidas técnicas e organizacionais razoáveis — criptografia em trânsito, controle
        de acesso e isolamento entre contas de empresas diferentes — para proteger os dados contra
        acesso não autorizado, perda ou alteração.
      </p>

      <h2 style={h2}>7. Cookies</h2>
      <p style={p}>
        Usamos cookies estritamente necessários para manter sua sessão autenticada no dashboard.
        Não usamos cookies de rastreamento publicitário.
      </p>

      <h2 style={h2}>8. Alterações desta Política</h2>
      <p style={p}>
        Podemos atualizar esta Política periodicamente; a versão vigente está sempre disponível
        nesta página, com a data da última atualização no topo.
      </p>

      <h2 style={h2}>9. Encarregado de Dados (DPO)</h2>
      <p style={p}>
        Para exercer seus direitos ou tirar dúvidas sobre o tratamento de dados:{' '}
        <strong>[nome / e-mail do encarregado]</strong>.
      </p>
    </LegalPage>
  );
}
