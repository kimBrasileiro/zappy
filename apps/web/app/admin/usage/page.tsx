import { prisma } from '@zappigo/db';
import { currentMonthStart, DEFAULT_MONTHLY_MESSAGE_LIMIT, getMonthlyMessageLimit } from '../../../lib/bot/quota';

// Always reflects the current month's real data — Next.js's build-time
// static-generation attempt otherwise tries (and fails, harmlessly but
// noisily in the build log) to reach the database at build time, since this
// page has no static shell to fall back to anyway.
export const dynamic = 'force-dynamic';

interface UsageMetadata {
  costUsd?: number;
  tokens?: { prompt?: number; completion?: number };
}

// Used only when there isn't enough real usage yet this month to compute a
// live average (a brand-new deploy, or a quiet month) — measured against a
// real Gemini 2.5 Flash call using this bot's actual system prompt/tools
// (round-trip tool-call + final-answer turn), not a guess. Once real
// customer-message volume exists, the page always prefers the live number.
const FALLBACK_AVG_COST_PER_MESSAGE_USD = 0.0012;

function quotaBadge(usedPct: number) {
  if (usedPct >= 100) return { className: 'dash-badge dash-badge-canceled', label: 'Limite atingido' };
  if (usedPct >= 80) return { className: 'dash-badge dash-badge-past_due', label: 'Perto do limite' };
  return { className: 'dash-badge dash-badge-active', label: 'Normal' };
}

export default async function AdminUsagePage() {
  const monthStart = currentMonthStart();

  const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });

  const [customerCounts, botMessages] = await Promise.all([
    prisma.message.groupBy({
      by: ['companyId'],
      where: { senderType: 'customer', createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    // Not grouped in SQL: costUsd/tokens live inside the JSON metadata column
    // (see lib/bot/conversation.ts#appendMessage), and the monthly message
    // quota already bounds this to at most a couple thousand rows per
    // company — cheap enough to sum in JS without raw SQL JSON casts.
    prisma.message.findMany({
      where: { senderType: 'bot', createdAt: { gte: monthStart } },
      select: { companyId: true, metadata: true },
    }),
  ]);

  const countByCompany = new Map(customerCounts.map((c) => [c.companyId, c._count._all]));
  const costByCompany = new Map<string, { costUsd: number; promptTokens: number; completionTokens: number }>();
  for (const m of botMessages) {
    const meta = m.metadata as UsageMetadata | null;
    const entry = costByCompany.get(m.companyId) ?? { costUsd: 0, promptTokens: 0, completionTokens: 0 };
    entry.costUsd += meta?.costUsd ?? 0;
    entry.promptTokens += meta?.tokens?.prompt ?? 0;
    entry.completionTokens += meta?.tokens?.completion ?? 0;
    costByCompany.set(m.companyId, entry);
  }

  const rows = companies
    .map((company) => {
      const messages = countByCompany.get(company.id) ?? 0;
      const limit = getMonthlyMessageLimit(company);
      const cost = costByCompany.get(company.id) ?? { costUsd: 0, promptTokens: 0, completionTokens: 0 };
      const usedPct = limit > 0 ? Math.round((messages / limit) * 100) : 0;
      return { company, messages, limit, usedPct, ...cost };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  const totalCostUsd = rows.reduce((sum, r) => sum + r.costUsd, 0);
  const totalMessages = rows.reduce((sum, r) => sum + r.messages, 0);
  const activeCompanyCount = companies.filter((c) => c.status === 'active').length;

  // "Se mantivermos o plano grátis, quanto gastamos por empresa, em média?"
  // Two different questions, both worth showing: what we're ACTUALLY
  // averaging today (real spend so far ÷ active companies — low until real
  // usage builds up), vs. the WORST CASE per company the quota guardrail
  // itself bounds things to (real/fallback $-per-message × the monthly
  // message limit) — the number that matters for "can we afford this at
  // scale" even before there's a full month of real data to average.
  const avgCostPerMessageUsd = totalMessages > 0 ? totalCostUsd / totalMessages : FALLBACK_AVG_COST_PER_MESSAGE_USD;
  const avgSpendPerActiveCompanyUsd = activeCompanyCount > 0 ? totalCostUsd / activeCompanyCount : 0;
  const maxSpendPerCompanyUsd = avgCostPerMessageUsd * DEFAULT_MONTHLY_MESSAGE_LIMIT;

  return (
    <>
      <h1 className="dash-h1">Gastos de IA</h1>
      <p className="dash-subtitle">
        Consumo de Gemini por empresa neste mês (desde {monthStart.toLocaleDateString('pt-BR')}). Cada empresa tem um teto
        mensal de mensagens automáticas — ao atingi-lo, a conversa é encaminhada para atendimento humano em vez de
        continuar consumindo IA.
      </p>

      <div className="dash-stat-grid">
        <div className="dash-stat-tile">
          <span className="dash-stat-value">US$ {totalCostUsd.toFixed(2)}</span>
          <span className="dash-stat-label">Gasto total estimado (mês)</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{totalMessages}</span>
          <span className="dash-stat-label">Mensagens de clientes (mês)</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">{activeCompanyCount}</span>
          <span className="dash-stat-label">Empresas ativas</span>
        </div>
      </div>

      <div className="dash-section-title">Projeção por empresa (mantendo o plano grátis)</div>
      <div className="dash-stat-grid">
        <div className="dash-stat-tile">
          <span className="dash-stat-value">US$ {avgSpendPerActiveCompanyUsd.toFixed(2)}</span>
          <span className="dash-stat-label">Gasto médio real por empresa (mês)</span>
        </div>
        <div className="dash-stat-tile">
          <span className="dash-stat-value">US$ {maxSpendPerCompanyUsd.toFixed(2)}</span>
          <span className="dash-stat-label">Teto de gasto por empresa (no limite de {DEFAULT_MONTHLY_MESSAGE_LIMIT} msgs/mês)</span>
        </div>
      </div>
      <p className="dash-subtitle" style={{ marginTop: '-0.5rem' }}>
        Teto calculado a partir do custo médio real por mensagem deste mês
        {totalMessages === 0 && ' (ainda sem mensagens este mês — usando uma estimativa medida em teste real)'}; é o pior
        caso já limitado pelo teto de mensagens acima, não uma projeção sem controle.
      </p>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Mensagens / limite</th>
            <th>Uso do teto</th>
            <th>Tokens (entrada/saída)</th>
            <th>Gasto estimado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ company, messages, limit, usedPct, costUsd, promptTokens, completionTokens }) => {
            const badge = quotaBadge(usedPct);
            return (
              <tr key={company.id}>
                <td>
                  {company.name}
                  <div style={{ fontSize: '0.8em', color: '#999' }}>{company.slug}</div>
                </td>
                <td>
                  {messages} / {limit}
                </td>
                <td>
                  <span className={badge.className}>
                    {usedPct}% — {badge.label}
                  </span>
                </td>
                <td>
                  {promptTokens.toLocaleString('pt-BR')} / {completionTokens.toLocaleString('pt-BR')}
                </td>
                <td>US$ {costUsd.toFixed(4)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: '#999' }}>
                Nenhuma empresa ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
