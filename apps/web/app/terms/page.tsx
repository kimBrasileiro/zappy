import type { Metadata } from 'next';
import { LegalPage } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  robots: { index: false }, // legal boilerplate, not a page worth ranking
};

const h2 = { fontSize: 18, margin: '32px 0 10px' };
const p = { margin: '0 0 12px' };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" lastUpdated="27 de julho de 2026">
      <p style={p}>
        Estes Termos de Uso (&quot;Termos&quot;) regem o uso da plataforma Zappigo (&quot;Zappigo&quot;,
        &quot;nós&quot;), operada por <strong>KIM BRASILEIRO LEAL LTDA</strong>, CNPJ{' '}
        <strong>63.020.695/0001-93</strong>, com sede em São Paulo/SP, por você
        (&quot;Contratante&quot;) ao criar uma conta e usar nossos serviços de atendimento
        automatizado via inteligência artificial, incluindo chat no site, WhatsApp, agendamento
        automático e FAQ.
      </p>

      <h2 style={h2}>1. Descrição do serviço</h2>
      <p style={p}>
        A Zappigo é uma plataforma multi-tenant que permite à Contratante configurar um assistente
        virtual de IA para responder dúvidas de clientes finais, agendar horários e escalar
        conversas para atendimento humano, integrável via widget de chat no site e/ou WhatsApp.
      </p>

      <h2 style={h2}>2. Cadastro e conta</h2>
      <p style={p}>
        Para usar a Zappigo, você deve fornecer informações verdadeiras, completas e atualizadas, e é
        responsável por manter a confidencialidade da sua senha e por todas as atividades
        realizadas na sua conta. Você declara ter capacidade legal para contratar em nome da
        empresa que está cadastrando.
      </p>

      <h2 style={h2}>3. Período gratuito, planos futuros e direito de alteração</h2>
      <p style={p}>
        Atualmente, o uso da Zappigo é <strong>gratuito, sem necessidade de cartão de crédito</strong>,
        por prazo indeterminado, enquanto durar a fase de lançamento e validação da plataforma no
        Brasil. Isso não constitui promessa de gratuidade permanente nem direito adquirido a
        continuar usando a plataforma gratuitamente.
      </p>
      <p style={p}>
        A KIM BRASILEIRO LEAL LTDA se reserva o direito, a seu exclusivo critério, de: (i) passar a
        cobrar pelo uso da plataforma, seja por meio de planos pagos com cobrança mensal recorrente
        processados pelo Stripe, seja por outro modelo de cobrança; e/ou (ii) suspender, encerrar ou
        modificar substancialmente a plataforma, no todo ou em parte, a qualquer momento. Qualquer
        uma dessas mudanças será comunicada à Contratante com pelo menos{' '}
        <strong>30 (trinta) dias de antecedência</strong>, por e-mail cadastrado e/ou aviso no
        próprio painel, antes de entrar em vigor.
      </p>
      <p style={p}>
        Caso a Zappigo passe a cobrar pelo uso, os preços vigentes na ocasião estarão disponíveis
        em <strong>[zappigo.com.br/#precos]</strong>. A Contratante poderá optar por não aderir ao
        plano pago, hipótese em que o acesso poderá ser suspenso ao fim do prazo de aviso acima. Uma
        vez ativos, planos pagos podem ser reajustados mediante aviso prévio de pelo menos 30 dias,
        aplicável a partir do próximo ciclo de cobrança; o não pagamento de uma fatura pode resultar
        na suspensão do acesso até a regularização.
      </p>

      <h2 style={h2}>4. Cancelamento</h2>
      <p style={p}>
        Você pode cancelar sua assinatura a qualquer momento pelo dashboard (Assinatura → Cancelar
        assinatura), sem multa. O cancelamento interrompe a renovação automática; o acesso
        permanece ativo até o fim do período já pago. Não há reembolso de valores já pagos, exceto
        quando exigido por lei (ex: arrependimento em até 7 dias da primeira contratação, nos
        termos do art. 49 do Código de Defesa do Consumidor, quando aplicável).
      </p>

      <h2 style={h2}>5. Uso aceitável</h2>
      <p style={p}>Você concorda em não usar a Zappigo para:</p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>
        <li>enviar spam ou conteúdo ilegal, discriminatório ou que viole direitos de terceiros;</li>
        <li>tentar acessar dados de outras empresas cadastradas na plataforma;</li>
        <li>usar o número de WhatsApp compartilhado da Zappigo para fins diferentes do atendimento aos seus próprios clientes;</li>
        <li>sobrecarregar ou tentar comprometer a infraestrutura da plataforma.</li>
      </ul>

      <h2 style={h2}>6. Propriedade intelectual</h2>
      <p style={p}>
        A Zappigo e todo o seu software, marca e conteúdo são de propriedade da{' '}
        <strong>KIM BRASILEIRO LEAL LTDA</strong>. O conteúdo que você cadastra (serviços, FAQs, dados de
        clientes) permanece de sua propriedade; você concede à Zappigo uma licença limitada para
        processá-lo exclusivamente para prestar o serviço contratado.
      </p>

      <h2 style={h2}>7. Dados e privacidade</h2>
      <p style={p}>
        O tratamento de dados pessoais pela Zappigo — seus e dos seus clientes finais — segue nossa{' '}
        <a href="/privacy" style={{ color: '#2563eb' }}>
          Política de Privacidade
        </a>
        , parte integrante destes Termos.
      </p>

      <h2 style={h2}>8. Limitação de responsabilidade</h2>
      <p style={p}>
        A Zappigo é fornecida &quot;como está&quot;. Fazemos esforços razoáveis para manter o serviço
        disponível e preciso, mas não garantimos operação ininterrupta ou livre de erros. Na máxima
        extensão permitida em lei, nossa responsabilidade por danos decorrentes do uso da
        plataforma fica limitada ao valor pago pela Contratante nos 12 meses anteriores ao evento
        — ou, durante o período de uso gratuito descrito na cláusula 3, ao valor de R$ 500,00
        (quinhentos reais) — excluindo-se lucros cessantes e danos indiretos. Esta limitação não
        afeta direitos que não podem ser excluídos por lei, incluindo os previstos no Código de
        Defesa do Consumidor, nem se aplica a danos decorrentes de dolo ou culpa grave.
      </p>

      <h2 style={h2}>9. Suspensão e rescisão</h2>
      <p style={p}>
        Podemos suspender ou encerrar sua conta em caso de violação destes Termos, inadimplência
        não regularizada, ou uso que coloque em risco a plataforma ou outros usuários, mediante
        notificação prévia sempre que possível.
      </p>

      <h2 style={h2}>10. Alterações destes Termos</h2>
      <p style={p}>
        Podemos atualizar estes Termos periodicamente. Mudanças materiais serão comunicadas com
        antecedência razoável; o uso continuado da plataforma após a alteração constitui aceite dos
        novos Termos.
      </p>

      <h2 style={h2}>11. Lei aplicável e foro</h2>
      <p style={p}>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de{' '}
        <strong>São Paulo/SP</strong> para dirimir eventuais controvérsias, com renúncia a qualquer
        outro, por mais privilegiado que seja, ressalvado o foro do domicílio do consumidor quando
        a lei assim exigir.
      </p>

      <h2 style={h2}>12. Disposições gerais</h2>
      <p style={p}>
        Estes Termos, junto com a Política de Privacidade, constituem o acordo integral entre as
        partes sobre o seu objeto, substituindo entendimentos anteriores. Se qualquer cláusula for
        considerada inválida ou inexequível, as demais permanecem em pleno vigor. A tolerância de
        uma parte quanto ao descumprimento de qualquer obrigação pela outra não implica renúncia ao
        direito de exigi-la posteriormente. Nenhuma das partes será responsável por atraso ou
        inadimplemento causado por evento de força maior, nos termos do art. 393 do Código Civil. A
        Contratante não pode ceder este contrato a terceiros sem autorização prévia da Zappigo; a
        Zappigo pode cedê-lo livremente em caso de reorganização societária, fusão, aquisição ou
        venda de ativos, sem que isso reduza os direitos já garantidos à Contratante.
      </p>

      <h2 style={h2}>13. Contato</h2>
      <p style={p}>Dúvidas sobre estes Termos: kim@wisell.ai.</p>
    </LegalPage>
  );
}
