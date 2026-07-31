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
    <LegalPage title="Termos de Uso" lastUpdated="30 de julho de 2026">
      <h2 style={h2}>1. Partes e aceitação</h2>
      <p style={p}>
        Estes Termos de Uso (&quot;Termos&quot;) regem o uso da plataforma Zappigo
        (&quot;Zappigo&quot;, &quot;nós&quot;) por você (&quot;Contratante&quot;). Dúvidas sobre
        estes Termos: <strong>suporte@zappigo.com.br</strong>.
      </p>
      <p style={p}>
        Ao clicar em &quot;Criar conta&quot; (ou equivalente) e efetivamente concluir o cadastro,
        você declara ter lido, compreendido e aceitado integralmente estes Termos e a{' '}
        <a href="/privacy" style={{ color: '#2563eb' }}>
          Política de Privacidade
        </a>{' '}
        — aceitação eletrônica válida e vinculante nos termos do art. 107 do Código Civil e da Lei
        nº 14.063/2020, independentemente de assinatura física.
      </p>

      <h2 style={h2}>2. Objeto do contrato</h2>
      <p style={p}>
        A Zappigo é uma plataforma multi-tenant que permite à Contratante configurar um assistente
        virtual de IA para responder dúvidas de clientes finais, agendar horários e escalar
        conversas para atendimento humano, integrável via widget de chat no site e/ou WhatsApp.
      </p>

      <h2 style={h2}>3. Cadastro e conta</h2>
      <p style={p}>
        Para usar a Zappigo, você deve fornecer informações verdadeiras, completas e atualizadas, e é
        responsável por manter a confidencialidade da sua senha e por todas as atividades
        realizadas na sua conta. Você declara ter capacidade legal para contratar em nome da
        empresa que está cadastrando.
      </p>

      <h2 style={h2}>4. Plano de acesso e preço</h2>
      <p style={p}>
        Atualmente, o uso da Zappigo é <strong>gratuito, sem necessidade de cartão de crédito</strong>,
        por prazo indeterminado, enquanto durar a fase de lançamento e validação da plataforma no
        Brasil. Isso não constitui promessa de gratuidade permanente nem direito adquirido a
        continuar usando a plataforma gratuitamente.
      </p>
      <p style={p}>
        A Zappigo se reserva o direito, a seu exclusivo critério, de: (i) passar a
        cobrar pelo uso da plataforma, seja por meio de planos pagos com cobrança mensal recorrente
        processados pelo Stripe, seja por outro modelo de cobrança; e/ou (ii) suspender, encerrar ou
        modificar substancialmente a plataforma, no todo ou em parte, a qualquer momento. Qualquer
        uma dessas mudanças será comunicada à Contratante com pelo menos{' '}
        <strong>30 (trinta) dias de antecedência</strong>, por e-mail cadastrado e/ou aviso no
        próprio painel, antes de entrar em vigor.
      </p>
      <p style={p}>
        Caso a Zappigo passe a cobrar pelo uso, os preços vigentes na ocasião estarão disponíveis
        em <strong>zappigo.com.br/#precos</strong>. Contratantes já ativas mantêm o preço vigente na
        data em que a cobrança começar a valer para elas até o fim do ciclo em curso — qualquer
        reajuste posterior segue o aviso prévio de 30 dias abaixo, nunca retroativo. A Contratante
        poderá optar por não aderir ao plano pago, hipótese em que o acesso poderá ser suspenso ao
        fim do prazo de aviso acima. Uma vez ativos, planos pagos podem ser reajustados mediante
        aviso prévio de pelo menos 30 dias, aplicável a partir do próximo ciclo de cobrança; o não
        pagamento de uma fatura pode resultar na suspensão do acesso até a regularização.
      </p>

      <h2 style={h2}>5. Licença de uso</h2>
      <p style={p}>
        A Zappigo concede à Contratante uma licença limitada, não exclusiva, intransferível e
        revogável para acessar e usar a plataforma exclusivamente para os fins previstos nestes
        Termos, durante a vigência do contrato. É vedado copiar, modificar, fazer engenharia reversa,
        descompilar, sublicenciar ou revender a plataforma (inclusive em modelo white-label) sem
        autorização expressa e por escrito da Zappigo.
      </p>

      <h2 style={h2}>6. Obrigações da Contratante</h2>
      <p style={p}>Você concorda em não usar a Zappigo para:</p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>
        <li>enviar spam ou conteúdo ilegal, discriminatório ou que viole direitos de terceiros;</li>
        <li>tentar acessar dados de outras empresas cadastradas na plataforma;</li>
        <li>usar o número de WhatsApp compartilhado da Zappigo para fins diferentes do atendimento aos seus próprios clientes;</li>
        <li>enviar mensagens a clientes finais que não tenham consentido em recebê-las por esse canal;</li>
        <li>sobrecarregar ou tentar comprometer a infraestrutura da plataforma.</li>
      </ul>
      <p style={p}>
        <strong>Conformidade com a LGPD.</strong> A Contratante é responsável por ter base legal
        própria para tratar os dados dos seus clientes finais e por cumprir a LGPD na relação com
        eles, na medida em que a Zappigo atua como operadora desses dados (ver{' '}
        <a href="/privacy" style={{ color: '#2563eb' }}>
          Política de Privacidade
        </a>
        , seção 2).
      </p>
      <p style={p}>
        <strong>Transparência sobre IA.</strong> É responsabilidade da Contratante não induzir seus
        clientes finais a erro sobre estarem conversando com um assistente automatizado, quando
        questionados diretamente sobre isso.
      </p>
      <p style={p}>
        <strong>Número de WhatsApp compartilhado.</strong> Enquanto a Contratante estiver no plano
        que usa o número de WhatsApp compartilhado da Zappigo, ela é responsável por obter o
        consentimento prévio de seus próprios clientes finais para contato por esse canal, conforme
        exigido pelas políticas comerciais da Meta. Denúncias de spam, bloqueio ou banimento do
        número causados por conduta de uma Contratante podem afetar a disponibilidade do canal para
        as demais — a Zappigo não se responsabiliza por indisponibilidade decorrente de ação de
        terceiros (Meta) motivada por uso indevido de qualquer Contratante, e a Contratante responde
        por prejuízos causados às demais nesse cenário.
      </p>
      <p style={p}>
        <strong>Limite de uso razoável.</strong> Para viabilizar a oferta gratuita e conter custos de
        processamento por IA, aplicamos um teto de mensagens automáticas por mês por Contratante
        (atualmente 500 mensagens de clientes finais/mês, ajustável a nosso critério). Ao atingir o
        teto, novas conversas do mês corrente são encaminhadas diretamente para atendimento humano
        em vez de continuar sendo processadas pela IA. Contratantes com necessidade de volume maior
        podem solicitar um limite personalizado pelo contato indicado na seção 1.
      </p>

      <h2 style={h2}>7. Obrigações da Zappigo</h2>
      <p style={p}>
        A Zappigo se compromete a envidar esforços razoáveis para manter a plataforma disponível e
        funcionando corretamente, a avisar previamente sobre manutenções programadas que possam
        causar indisponibilidade relevante, a cumprir a LGPD no tratamento dos dados que trata como
        controladora (ver Política de Privacidade), a adotar medidas de segurança compatíveis com o
        porte da operação, e a prestar suporte pelo canal indicado na seção 1. Não garantimos
        disponibilidade ininterrupta — ver seção 12 (Exclusão de garantias).
      </p>

      <h2 style={h2}>8. Inteligência artificial — limitações e responsabilidade</h2>
      <p style={p}>
        O assistente virtual da Zappigo é baseado em modelos de linguagem de terceiros e pode, em
        alguns casos, gerar respostas incompletas, desatualizadas ou incorretas, apesar dos esforços
        técnicos para reduzir esse risco (ex: respostas fundamentadas nos serviços, preços e FAQ
        efetivamente cadastrados pela Contratante). A Contratante é responsável por revisar e manter
        atualizado o catálogo de serviços, preços e FAQ configurado na plataforma, e por verificar
        junto ao cliente final qualquer informação crítica antes de considerá-la definitiva. A
        Zappigo não garante a exatidão do conteúdo gerado pela IA e não se responsabiliza por
        compromissos que a própria Contratante não possa cumprir em decorrência de uma resposta
        incorreta do assistente.
      </p>

      <h2 style={h2}>9. Propriedade intelectual</h2>
      <p style={p}>
        A Zappigo e todo o seu software, marca e conteúdo são de nossa propriedade. O conteúdo que
        você cadastra (serviços, FAQs, dados de clientes) permanece de sua propriedade; você concede
        à Zappigo uma licença limitada para processá-lo exclusivamente para prestar o serviço
        contratado.
      </p>

      <h2 style={h2}>10. Confidencialidade</h2>
      <p style={p}>
        Cada parte se compromete a manter em sigilo as informações confidenciais da outra parte
        obtidas em razão deste contrato (incluindo, no caso da Contratante, dados de configuração,
        catálogo e clientes; e, no caso da Zappigo, aspectos técnicos e comerciais não públicos da
        plataforma), usando-as apenas para os fins deste contrato, por prazo de 3 (três) anos após o
        seu término — exceto informações que já sejam públicas, que a parte já detivesse
        legitimamente antes da divulgação, ou cuja divulgação seja exigida por lei ou ordem judicial.
      </p>

      <h2 style={h2}>11. Limitação de responsabilidade</h2>
      <p style={p}>
        Na máxima extensão permitida em lei, nossa responsabilidade por danos decorrentes do uso da
        plataforma fica limitada ao valor pago pela Contratante nos 3 (três) meses anteriores ao
        evento — ou, durante o período de uso gratuito descrito na seção 4, ao valor de R$ 500,00
        (quinhentos reais) — excluindo-se lucros cessantes, danos indiretos e falhas de terceiros
        (ex: indisponibilidade do WhatsApp/Meta, do provedor de IA ou de outros subprocessadores).
        Esta limitação não afeta direitos que não podem ser excluídos por lei, incluindo os
        previstos no Código de Defesa do Consumidor, nem se aplica a danos decorrentes de dolo ou
        culpa grave.
      </p>

      <h2 style={h2}>12. Exclusão de garantias</h2>
      <p style={p}>
        A Zappigo é fornecida &quot;como está&quot; e &quot;conforme disponível&quot;. Fazemos
        esforços razoáveis para manter o serviço disponível e preciso, mas não garantimos operação
        ininterrupta ou livre de erros, nem resultados específicos de negócio decorrentes do uso da
        plataforma.
      </p>

      <h2 style={h2}>13. Indenização</h2>
      <p style={p}>
        A Contratante concorda em indenizar e isentar a Zappigo de reclamações, perdas ou danos de
        terceiros decorrentes de: uso da plataforma em violação destes Termos ou da lei; conteúdo
        cadastrado pela Contratante (serviços, FAQ, políticas de cancelamento); ou envio de
        mensagens a clientes finais sem o consentimento exigido na seção 6 — incluindo eventuais
        reclamações desses clientes finais ou sanções aplicadas pela Meta/WhatsApp motivadas por
        conduta da própria Contratante.
      </p>

      <h2 style={h2}>14. Vigência e resolução</h2>
      <p style={p}>
        Você pode cancelar sua assinatura a qualquer momento pelo dashboard (Assinatura → Cancelar
        assinatura), sem multa. O cancelamento interrompe a renovação automática; o acesso
        permanece ativo até o fim do período já pago. Não há reembolso de valores já pagos, exceto
        quando exigido por lei (ex: arrependimento em até 7 dias da primeira contratação, nos
        termos do art. 49 do Código de Defesa do Consumidor, quando aplicável).
      </p>
      <p style={p}>
        Podemos suspender ou encerrar sua conta em caso de violação destes Termos, inadimplência
        não regularizada, ou uso que coloque em risco a plataforma ou outros usuários, mediante
        notificação prévia sempre que possível. Encerrada a conta (por cancelamento ou rescisão), a
        Contratante pode solicitar a exportação de seus dados (histórico de conversas, agendamentos
        e cadastros) em até 30 dias a partir do encerramento, findo o qual os dados seguem o prazo
        de retenção descrito na Política de Privacidade.
      </p>

      <h2 style={h2}>15. Proteção de dados</h2>
      <p style={p}>
        O tratamento de dados pessoais pela Zappigo — seus e dos seus clientes finais — segue nossa{' '}
        <a href="/privacy" style={{ color: '#2563eb' }}>
          Política de Privacidade
        </a>
        , parte integrante destes Termos.
      </p>

      <h2 style={h2}>16. Modificações destes Termos</h2>
      <p style={p}>
        Podemos atualizar estes Termos periodicamente, com aviso prévio de pelo menos 30 dias para
        mudanças materiais, por e-mail cadastrado e/ou aviso no painel. O uso continuado da
        plataforma após a alteração entrar em vigor constitui aceite dos novos Termos.
      </p>

      <h2 style={h2}>17. Lei aplicável e jurisdição</h2>
      <p style={p}>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de{' '}
        <strong>São Paulo/SP</strong> para dirimir eventuais controvérsias, com renúncia a qualquer
        outro, por mais privilegiado que seja, ressalvado o foro do domicílio do consumidor quando
        a lei assim exigir.
      </p>

      <h2 style={h2}>18. Disposições finais</h2>
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
    </LegalPage>
  );
}
