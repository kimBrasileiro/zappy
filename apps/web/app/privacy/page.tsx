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
    <LegalPage title="Política de Privacidade" lastUpdated="28 de julho de 2026">
      <p style={p}>
        A Zappigo, operada por <strong>KIM BRASILEIRO LEAL LTDA</strong>, CNPJ{' '}
        <strong>63.020.695/0001-93</strong>, com sede em São Paulo/SP, é controladora dos dados
        pessoais tratados conforme descrito nesta Política, em conformidade com a Lei Geral de
        Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2 style={h2}>1. Quais dados coletamos</h2>
      <p style={p}>
        <strong>Da empresa Contratante e seus usuários:</strong> nome, e-mail, senha (armazenada de
        forma criptografada) e dados de pagamento — processados diretamente pelo Stripe, a Zappigo
        nunca armazena número de cartão.
      </p>
      <p style={p}>
        <strong>Dos clientes finais da Contratante</strong> (pessoas que conversam com o
        assistente): nome, telefone, e-mail (quando informado), histórico de conversas e dados de
        agendamento. Esses dados são coletados em nome da Contratante, que é a controladora perante
        os próprios clientes dela — a Zappigo atua como operadora nesse contexto específico.
      </p>
      <p style={p}>
        <strong>Menores de idade.</strong> A Zappigo não coleta intencionalmente dados de menores de
        18 anos diretamente. Quando a Contratante atua em segmento cujos clientes finais possam ser
        menores (ex: clínicas pediátricas), é responsabilidade da Contratante obter o consentimento
        de um responsável legal antes de fornecer dados do menor ao assistente, nos termos do art.
        14 da LGPD.
      </p>

      <h2 style={h2}>2. Base legal e finalidade do tratamento</h2>
      <p style={p}>
        Para a Contratante e seus usuários, tratamos dados com base na execução do contrato de
        prestação de serviço firmado com a Zappigo (Art. 7º, V, LGPD), cumprimento de obrigação
        legal ou regulatória (ex: fiscal), legítimo interesse para prevenção a fraude e melhoria do
        serviço, e consentimento quando aplicável.
      </p>
      <p style={p}>
        Para os clientes finais da Contratante, a base legal aplicável é, em regra, a execução do
        contrato firmado entre eles e a própria Contratante (ex: o agendamento de um serviço) — não
        um contrato com a Zappigo. Nesse fluxo, a Zappigo trata esses dados estritamente como
        operadora, seguindo as instruções e finalidades definidas pela Contratante, que responde
        como controladora perante os próprios clientes dela.
      </p>

      <h2 style={h2}>3. Dado sensível</h2>
      <p style={p}>
        Caso a Contratante opere em segmento que envolva dado de saúde (ex: clínicas, pet care com
        histórico veterinário), o assistente pode coletar incidentalmente informações classificadas
        como dado sensível pelo art. 5º, II da LGPD (ex: motivo de consulta, sintomas). Nesses
        casos, é responsabilidade da Contratante — não da Zappigo — obter consentimento específico e
        destacado do titular para esse tratamento (art. 11, LGPD) antes de inserir essa informação
        na conversa com o assistente; a Zappigo permanece operadora, tratando esse dado apenas para
        prestar o serviço configurado pela Contratante.
      </p>

      <h2 style={h2}>4. Com quem compartilhamos dados</h2>
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
          <strong>Meta / WhatsApp Cloud API</strong> — mensageria via WhatsApp;
        </li>
        <li>
          <strong>Google Analytics</strong> — métricas agregadas de uso do site (ver seção 8).
        </li>
      </ul>
      <p style={p}>
        <strong>Transferência internacional de dados (Art. 33, LGPD).</strong> Google e Meta são
        empresas sediadas nos Estados Unidos, de modo que os dados processados por esses
        subprocessadores podem ser transferidos internacionalmente. Utilizamos a API paga do Google
        Gemini (uso faturado, não o nível gratuito) — segundo os Termos de Serviço vigentes da API
        Gemini, dados enviados via API paga <strong>não são utilizados pelo Google para treinar ou
        melhorar seus modelos</strong>, sendo registrados apenas por período limitado para detecção e
        prevenção de abuso. Recomendamos consultar diretamente os termos vigentes do Google e da
        Meta para o detalhamento mais atual dessas garantias.
      </p>

      <h2 style={h2}>5. Retenção</h2>
      <p style={p}>
        Mantemos os dados enquanto a conta estiver ativa. Após o encerramento da conta (cancelamento
        ou rescisão), os dados são mantidos por até <strong>90 (noventa) dias</strong> — prazo em que
        a Contratante pode solicitar a exportação prevista nos Termos de Uso — e então eliminados ou
        anonimizados, salvo prazo adicional exigido por obrigação legal (ex: fiscal, tipicamente 5
        anos) ou necessário para defesa de direitos em processos.
      </p>

      <h2 style={h2}>6. Direitos do titular</h2>
      <p style={p}>
        Nos termos do Art. 18 da LGPD, você (ou o cliente final da Contratante) pode solicitar
        confirmação da existência de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação de dados, informação sobre compartilhamento e revogação de consentimento.
        Solicitações podem ser feitas em <strong>suporte@zappigo.com.br</strong>. Você também tem o
        direito de peticionar diretamente à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2 style={h2}>7. Segurança e notificação de incidentes</h2>
      <p style={p}>
        Adotamos medidas técnicas e organizacionais razoáveis — criptografia em trânsito, controle
        de acesso e isolamento entre contas de empresas diferentes — para proteger os dados contra
        acesso não autorizado, perda ou alteração. Em caso de incidente de segurança que possa
        acarretar risco ou dano relevante aos titulares, notificaremos a ANPD e os titulares
        afetados em prazo razoável, nos termos do art. 48 da LGPD.
      </p>

      <h2 style={h2}>8. Cookies e analytics</h2>
      <p style={p}>
        Usamos cookies estritamente necessários para manter sua sessão autenticada no dashboard.
        Usamos também o <strong>Google Analytics (GA4)</strong> para entender de forma agregada
        como o site é utilizado (páginas visitadas, origem do acesso) — não usamos cookies de
        rastreamento publicitário. Os dados de navegação coletados pelo Google Analytics são
        tratados conforme a{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style={{ color: '#2563eb' }}>
          política de privacidade do Google
        </a>
        .
      </p>

      <h2 style={h2}>9. Alterações desta Política</h2>
      <p style={p}>
        Podemos atualizar esta Política periodicamente; a versão vigente está sempre disponível
        nesta página, com a data da última atualização no topo.
      </p>

      <h2 style={h2}>10. Encarregado de Dados (DPO)</h2>
      <p style={p}>
        Para exercer seus direitos ou tirar dúvidas sobre o tratamento de dados:{' '}
        <strong>Wisell — kim@wisell.ai</strong>.
      </p>
    </LegalPage>
  );
}
