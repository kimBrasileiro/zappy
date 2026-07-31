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
    <LegalPage title="Política de Privacidade" lastUpdated="30 de julho de 2026">
      <h2 style={h2}>1. Identificação da controladora</h2>
      <p style={p}>
        A Zappigo trata dados pessoais conforme descrito nesta Política, em conformidade com a Lei
        Geral de Proteção de Dados (LGPD, Lei 13.709/2018). Dado o porte atual da operação, não
        mantemos um Encarregado de Dados (DPO) formal dedicado — o contato abaixo cumpre esse papel
        e é o canal para exercício de direitos e dúvidas sobre esta Política:{' '}
        <strong>suporte@zappigo.com.br</strong>.
      </p>

      <h2 style={h2}>2. Natureza dupla do tratamento: controladora e operadora</h2>
      <p style={p}>
        A Zappigo atua em dois papéis diferentes, a depender de quem são os dados:
      </p>
      <p style={p}>
        <strong>Como controladora</strong>, em relação aos dados da própria empresa Contratante e de
        seus usuários (quem cria e usa a conta no dashboard) — coletados para prestar o serviço
        contratado diretamente.
      </p>
      <p style={p}>
        <strong>Como operadora</strong>, em relação aos dados dos clientes finais da Contratante
        (pessoas que conversam com o assistente virtual) — esses dados são coletados em nome da
        Contratante, que é a controladora perante os próprios clientes dela; a Zappigo os trata
        estritamente seguindo as instruções e finalidades definidas pela Contratante.
      </p>

      <h2 style={h2}>3. Dados tratados e finalidades</h2>
      <p style={p}>
        <strong>Da empresa Contratante e seus usuários:</strong> nome, e-mail, telefone (opcional),
        senha (armazenada de forma criptografada) e dados de pagamento — processados diretamente
        pelo Stripe, a Zappigo nunca armazena número de cartão. Usados para criar e manter sua
        conta, processar cobranças (quando aplicável) e dar suporte.
      </p>
      <p style={p}>
        <strong>Dos clientes finais da Contratante:</strong> nome, telefone, e-mail (quando
        informado), histórico de conversas e dados de agendamento. Usados exclusivamente para
        operar o assistente virtual configurado pela Contratante (responder dúvidas, agendar
        horários, encaminhar para atendimento humano).
      </p>
      <p style={p}>
        <strong>Dado sensível.</strong> Caso a Contratante opere em segmento que envolva dado de
        saúde (ex: clínicas, pet care com histórico veterinário), o assistente pode coletar
        incidentalmente informações classificadas como dado sensível pelo art. 5º, II da LGPD (ex:
        motivo de consulta, sintomas). Nesses casos, é responsabilidade da Contratante — não da
        Zappigo — obter consentimento específico e destacado do titular para esse tratamento (art.
        11, LGPD) antes de inserir essa informação na conversa com o assistente; a Zappigo permanece
        operadora, tratando esse dado apenas para prestar o serviço configurado pela Contratante.
      </p>
      <p style={p}>
        <strong>Menores de idade.</strong> A Zappigo não coleta intencionalmente dados de menores de
        18 anos diretamente. Quando a Contratante atua em segmento cujos clientes finais possam ser
        menores (ex: clínicas pediátricas), é responsabilidade da Contratante obter o consentimento
        de um responsável legal antes de fornecer dados do menor ao assistente, nos termos do art.
        14 da LGPD.
      </p>

      <h2 style={h2}>4. Base legal do tratamento</h2>
      <p style={p}>
        Para a Contratante e seus usuários, tratamos dados com base na execução do contrato de
        prestação de serviço firmado com a Zappigo (Art. 7º, V, LGPD), cumprimento de obrigação
        legal ou regulatória (ex: fiscal), legítimo interesse para prevenção a fraude e melhoria do
        serviço, e consentimento quando aplicável.
      </p>
      <p style={p}>
        Para os clientes finais da Contratante, a base legal aplicável é, em regra, a execução do
        contrato firmado entre eles e a própria Contratante (ex: o agendamento de um serviço) — não
        um contrato com a Zappigo, coerente com o papel de operadora descrito na seção 2.
      </p>

      <h2 style={h2}>5. Retenção de dados</h2>
      <p style={p}>
        Mantemos os dados enquanto a conta estiver ativa. Após o encerramento da conta (cancelamento
        ou rescisão), os dados são mantidos por até <strong>90 (noventa) dias</strong> — prazo em que
        a Contratante pode solicitar a exportação prevista nos Termos de Uso — e então eliminados ou
        anonimizados, salvo prazo adicional exigido por obrigação legal (ex: fiscal, tipicamente 5
        anos) ou necessário para defesa de direitos em processos.
      </p>

      <h2 style={h2}>6. Inteligência artificial: processamento e limitações</h2>
      <p style={p}>
        O assistente virtual processa as mensagens da conversa (e o catálogo/FAQ cadastrado pela
        Contratante) através da API do <strong>Google Gemini</strong> para gerar respostas. Utilizamos
        a API paga do Gemini (uso faturado, não o nível gratuito) — segundo os Termos de Serviço
        vigentes da API Gemini, dados enviados via API paga <strong>não são utilizados pelo Google
        para treinar ou melhorar seus modelos</strong>, sendo registrados apenas por período limitado
        para detecção e prevenção de abuso. Recomendamos consultar diretamente os termos vigentes do
        Google para o detalhamento mais atual dessas garantias. Sobre a confiabilidade das respostas
        geradas, ver Termos de Uso, seção 8.
      </p>

      <h2 style={h2}>7. Destinatários e operadores</h2>
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
          <strong>Google Analytics</strong> — métricas agregadas de uso do site (ver seção 11).
        </li>
      </ul>
      <p style={p}>
        <strong>Transferência internacional de dados (Art. 33, LGPD).</strong> Google e Meta são
        empresas sediadas nos Estados Unidos, de modo que os dados processados por esses
        subprocessadores podem ser transferidos internacionalmente, sob as garantias contratuais e
        de segurança oferecidas por esses fornecedores.
      </p>

      <h2 style={h2}>8. Direitos dos titulares</h2>
      <p style={p}>
        Nos termos do Art. 18 da LGPD, você (ou o cliente final da Contratante) pode solicitar
        confirmação da existência de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação de dados, informação sobre compartilhamento e revogação de consentimento.
        Solicitações podem ser feitas em <strong>suporte@zappigo.com.br</strong>.
      </p>

      <h2 style={h2}>9. Medidas de segurança</h2>
      <p style={p}>
        Adotamos medidas técnicas e organizacionais razoáveis — criptografia em trânsito, controle
        de acesso e isolamento entre contas de empresas diferentes — para proteger os dados contra
        acesso não autorizado, perda ou alteração. Em caso de incidente de segurança que possa
        acarretar risco ou dano relevante aos titulares, notificaremos a ANPD e os titulares
        afetados em prazo razoável, nos termos do art. 48 da LGPD.
      </p>

      <h2 style={h2}>10. Relação com a Contratante como operadora</h2>
      <p style={p}>
        Os Termos de Uso (seção 6) já estabelecem as obrigações da Contratante enquanto controladora
        dos dados dos próprios clientes finais dela, e as condições em que a Zappigo trata esses
        dados como operadora — não mantemos, no momento, um instrumento de tratamento de dados (DPA)
        separado; essa relação é regida pelos Termos de Uso e por esta Política em conjunto.
      </p>

      <h2 style={h2}>11. Cookies e analytics</h2>
      <p style={p}>
        Usamos cookies estritamente necessários para manter sua sessão autenticada no dashboard e
        para lembrar sua preferência de idioma. Usamos também o{' '}
        <strong>Google Analytics (GA4)</strong> para entender de forma agregada como o site é
        utilizado (páginas visitadas, origem do acesso) — não usamos cookies de rastreamento
        publicitário. Os dados de navegação coletados pelo Google Analytics são tratados conforme a{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style={{ color: '#2563eb' }}>
          política de privacidade do Google
        </a>
        .
      </p>

      <h2 style={h2}>12. Menores de idade</h2>
      <p style={p}>
        A Zappigo é um serviço B2B, contratado por empresas, e não é direcionado a menores de idade.
        Sobre dados de clientes finais menores de idade que eventualmente conversem com o assistente
        de uma Contratante, ver seção 3.
      </p>

      <h2 style={h2}>13. Alterações desta Política</h2>
      <p style={p}>
        Podemos atualizar esta Política periodicamente; a versão vigente está sempre disponível
        nesta página, com a data da última atualização no topo. Mudanças materiais serão comunicadas
        com aviso prévio de pelo menos 30 dias, por e-mail cadastrado e/ou aviso no painel.
      </p>

      <h2 style={h2}>14. Reclamações e recursos</h2>
      <p style={p}>
        Se você entender que seus dados não foram tratados corretamente, entre em contato primeiro
        em <strong>suporte@zappigo.com.br</strong> para que possamos resolver diretamente. Você
        também tem o direito de peticionar à Autoridade Nacional de Proteção de Dados (ANPD) —{' '}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noopener" style={{ color: '#2563eb' }}>
          gov.br/anpd
        </a>
        .
      </p>
    </LegalPage>
  );
}
