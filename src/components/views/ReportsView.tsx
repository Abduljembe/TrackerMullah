import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Download,
  FileJson,
  Printer,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { convertCurrency, getExchangeRate } from '../../utils/currency.ts';
import { loadManagedClosedTrades } from '../../utils/paperTradeManager.ts';
import { PAPER_POSITIONS_EVENT } from '../../utils/portfolioGuard.ts';
import { CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';

function computeEstimatedKraTaxKes(monthlyGrossKes: number) {
  if (monthlyGrossKes <= 0) {
    return { nssfKes: 0, shifKes: 0, housingKes: 0, payeKes: 0, totalDeductionsKes: 0 };
  }
  const nssfTier1 = Math.min(480, monthlyGrossKes * 0.06);
  const nssfTier2 = monthlyGrossKes > 8000 ? Math.min(1740, (monthlyGrossKes - 8000) * 0.06) : 0;
  const nssfKes = Math.round(nssfTier1 + nssfTier2);
  const housingKes = Math.round(monthlyGrossKes * 0.015);
  const shifKes = Math.max(300, Math.round(monthlyGrossKes * 0.0275));
  const taxable = Math.max(0, monthlyGrossKes - nssfKes);

  let rem = taxable;
  let grossTax = 0;
  const bands: Array<[number, number]> = [
    [24000, 0.1],
    [8333, 0.25],
    [467667, 0.3],
    [300000, 0.325],
    [Infinity, 0.35],
  ];
  for (const [cap, rate] of bands) {
    if (rem <= 0) break;
    const chunk = Math.min(rem, cap);
    grossTax += chunk * rate;
    rem -= chunk;
  }
  const personalRelief = 2400;
  const insuranceRelief = Math.min(5000, Math.round(shifKes * 0.15));
  const housingRelief = Math.min(750, Math.round(housingKes * 0.15));
  const payeKes = Math.max(0, Math.round(grossTax) - (personalRelief + insuranceRelief + housingRelief));

  return {
    nssfKes,
    shifKes,
    housingKes,
    payeKes,
    totalDeductionsKes: nssfKes + shifKes + housingKes + payeKes,
  };
}

export const ReportsView: React.FC = () => {
  const {
    currency,
    exchangeRates,
    formatCurrency,
    currentPeriod,
    totalMonthlyIncome,
    totalMonthlyExpenses,
    savingsThisMonth,
    savingsRate,
    totalInvestments,
    totalEmergencyFund,
    totalSavingsGoals,
    totalDebt,
    netWorth,
    incomes,
    expenses,
  } = useFinance();

  const [closedTrades, setClosedTrades] = useState(() => loadManagedClosedTrades());

  useEffect(() => {
    const sync = () => setClosedTrades(loadManagedClosedTrades());
    window.addEventListener(PAPER_POSITIONS_EVENT, sync);
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, sync);
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    };
  }, []);

  const usdToActive = getExchangeRate('USD', currency, exchangeRates);

  const tradingSummary = useMemo(() => {
    const total = closedTrades.length;
    const wins = closedTrades.filter((t) => t.outcome === 'WIN').length;
    const netUsd = Math.round(closedTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0) * 100) / 100;
    const sweptUsd = Number(localStorage.getItem('njia_wealth_bridge_allocated_usd') || '0') || 0;
    return {
      total,
      wins,
      losses: total - wins,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      netUsd,
      netActive: Math.round(netUsd * usdToActive * 100) / 100,
      sweptActive: Math.round(sweptUsd * usdToActive * 100) / 100,
    };
  }, [closedTrades, usdToActive]);

  const taxSummary = useMemo(() => {
    const grossIncomeKes =
      currency === 'KES'
        ? totalMonthlyIncome
        : convertCurrency(totalMonthlyIncome, currency, 'KES', exchangeRates);
    const est = computeEstimatedKraTaxKes(grossIncomeKes);
    const tradingNetKes = convertCurrency(Math.max(0, tradingSummary.netUsd), 'USD', 'KES', exchangeRates);
    // Conservative 15% withholding / capital provision benchmark on positive trading gains
    const tradingTaxProvisionKes = Math.round(tradingNetKes * 0.15);

    const fromKes = (valKes: number) =>
      currency === 'KES'
        ? valKes
        : Math.round(convertCurrency(valKes, 'KES', currency, exchangeRates) * 100) / 100;

    return {
      paye: fromKes(est.payeKes),
      nssf: fromKes(est.nssfKes),
      shif: fromKes(est.shifKes),
      housingLevy: fromKes(est.housingKes),
      statutoryTotal: fromKes(est.totalDeductionsKes),
      tradingProvision: fromKes(tradingTaxProvisionKes),
      combinedEstimatedTax: fromKes(est.totalDeductionsKes + tradingTaxProvisionKes),
    };
  }, [currency, exchangeRates, totalMonthlyIncome, tradingSummary.netUsd]);

  const totalAssets =
    Math.max(0, savingsThisMonth) + totalEmergencyFund + totalInvestments + totalSavingsGoals;

  const handleExportFullCsv = () => {
    const rows: string[] = [
      ['Section', 'Title / Symbol', 'Category / Side', 'Amount', 'Currency', 'Date / Time', 'Notes'].join(','),
      ...incomes.map((i) =>
        ['Income', `"${i.source}"`, `"${i.category}"`, i.amount, currency, i.date, `"${i.notes || ''}"`].join(',')
      ),
      ...expenses.map((e) =>
        ['Expense', `"${e.title}"`, `"${e.category}"`, -e.amount, currency, e.date, `"${e.notes || ''}"`].join(',')
      ),
      ...closedTrades.map((t) =>
        ['TradingJournal', `"${t.ticker}"`, t.direction, t.pnl, 'USD', `"${t.timestamp}"`, `"${t.strategy || ''}"`].join(',')
      ),
      ['TaxSummary', 'Estimated Statutory PAYE + NSSF/SHIF/AHL', 'Tax', taxSummary.statutoryTotal, currency, currentPeriod, 'Calculated monthly estimate'].join(','),
      ['TaxSummary', 'Trading Gain Provision (15%)', 'Tax', taxSummary.tradingProvision, currency, currentPeriod, 'Reserve on realized profit'].join(','),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MullahTracker_Dossier_${currentPeriod.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJsonSnapshot = () => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      period: currentPeriod,
      currency,
      cashflow: {
        totalMonthlyIncome,
        totalMonthlyExpenses,
        savingsThisMonth,
        savingsRate,
      },
      balanceSheet: {
        totalEmergencyFund,
        totalInvestments,
        totalSavingsGoals,
        totalDebt,
        netWorth,
      },
      trading: tradingSummary,
      taxProvisionEstimate: taxSummary,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MullahTracker_Audit_${currentPeriod.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="no-print bg-[#0e1626] border border-[#18263e] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-teal-400" />
            <span>Investor, Trading &amp; Tax Dossier</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidated statement for {currentPeriod} · Includes Personal Balance Sheet, Trading Journal P&amp;L &amp; Tax Provision
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportFullCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14233c] hover:bg-[#1a2d4d] border border-[#223656] text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJsonSnapshot}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14233c] hover:bg-[#1a2d4d] border border-[#223656] text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON Audit</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0df2c9] hover:bg-[#00d2b4] text-[#071317] text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Save PDF / Print Dossier</span>
          </button>
        </div>
      </div>

      {/* Print Header Banner (Visible cleanly when saved as PDF) */}
      <div className="print-dossier-sheet hidden print:block rounded-xl p-5 border border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">MullahTracker Executive Investor &amp; Tax Dossier</h1>
            <p className="text-xs mt-0.5">Reporting Period: {currentPeriod} · Display Currency: {currency}</p>
          </div>
          <div className="text-right text-xs font-mono">
            Generated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Cashflow & Balance Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="print-dossier-sheet bg-[#0e1626] border border-[#18263e] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#162237]">
            <h3 className="text-sm font-bold text-white">01. Cashflow Statement</h3>
            <span className="text-xs font-mono text-slate-400">{currentPeriod}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300 font-medium">Gross Inflows (Income)</span>
              <span className="font-mono tabular-nums text-[#00e5a3] font-bold">
                +{formatCurrency(totalMonthlyIncome)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300 font-medium">Total Operating Outflows (Expenses)</span>
              <span className="font-mono tabular-nums text-rose-400 font-bold">
                -{formatCurrency(totalMonthlyExpenses)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-[#141e30] bg-[#121c2d] px-3 rounded-lg">
              <span className="text-white font-bold">Net Cash Surplus / Savings</span>
              <span className={`font-mono tabular-nums font-bold ${savingsThisMonth >= 0 ? 'text-[#00d2ff]' : 'text-rose-400'}`}>
                {savingsThisMonth >= 0 ? '+' : ''}
                {formatCurrency(savingsThisMonth)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 text-slate-400">
              <span>Savings Rate</span>
              <span className="font-mono tabular-nums text-teal-400 font-semibold">{savingsRate}%</span>
            </div>
          </div>
        </div>

        <div className="print-dossier-sheet bg-[#0e1626] border border-[#18263e] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#162237]">
            <h3 className="text-sm font-bold text-white">02. Balance Sheet (Net Worth)</h3>
            <span className="text-xs font-mono text-slate-400">As of today</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Assets</div>
              <div className="flex justify-between py-1 pl-2 text-slate-300">
                <span>Emergency Reserve Fund</span>
                <span className="font-mono tabular-nums">{formatCurrency(totalEmergencyFund)}</span>
              </div>
              <div className="flex justify-between py-1 pl-2 text-slate-300">
                <span>Investment Holdings (MMF, SACCO, Stocks, Bonds)</span>
                <span className="font-mono tabular-nums">{formatCurrency(totalInvestments)}</span>
              </div>
              <div className="flex justify-between py-1 pl-2 text-slate-300">
                <span>Savings Goals Accounts</span>
                <span className="font-mono tabular-nums">{formatCurrency(totalSavingsGoals)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2 bg-[#121c2d] rounded font-semibold text-white">
                <span>Total Assets</span>
                <span className="font-mono tabular-nums text-teal-300">{formatCurrency(totalAssets)}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Liabilities</div>
              <div className="flex justify-between py-1 pl-2 text-slate-300">
                <span>Total Outstanding Debts &amp; Loans</span>
                <span className="font-mono tabular-nums text-rose-400">-{formatCurrency(totalDebt)}</span>
              </div>
            </div>

            <div className="flex justify-between py-2.5 px-3 bg-gradient-to-r from-[#122338] to-[#0f1b2b] border border-teal-500/30 rounded-xl text-sm font-bold text-white">
              <span>Total Net Worth</span>
              <span className="font-mono tabular-nums text-[#38bdf8]">{formatCurrency(netWorth)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Journal P&L & Estimated Tax Provision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="print-dossier-sheet bg-[#0e1626] border border-[#18263e] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#162237]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0df2c9]" />
              <span>03. Forex &amp; Stock Trading Performance</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{tradingSummary.total} Trades</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">Win / Loss Breakdown</span>
              <span className="font-mono tabular-nums text-white font-semibold">
                {tradingSummary.wins}W · {tradingSummary.losses}L ({tradingSummary.winRate}% Win Rate)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">Realized Trading Net P&amp;L (USD)</span>
              <span className={`font-mono tabular-nums font-bold ${tradingSummary.netUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {tradingSummary.netUsd >= 0 ? '+' : '-'}${Math.abs(tradingSummary.netUsd).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">Equivalent in {currency}</span>
              <span className="font-mono tabular-nums text-white">{formatCurrency(tradingSummary.netActive)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-slate-300">
              <span>Swept via Profit-to-Wealth Bridge</span>
              <span className="font-mono tabular-nums text-[#0df2c9] font-semibold">
                {formatCurrency(tradingSummary.sweptActive)}
              </span>
            </div>
          </div>
        </div>

        <div className="print-dossier-sheet bg-[#0e1626] border border-[#18263e] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#162237]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>04. Statutory &amp; Trading Tax Provision</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">KRA / Reserve Est.</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">Estimated PAYE on Recorded Income</span>
              <span className="font-mono tabular-nums text-slate-200">{formatCurrency(taxSummary.paye)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">NSSF + SHIF + Housing Levy</span>
              <span className="font-mono tabular-nums text-slate-200">
                {formatCurrency(taxSummary.nssf + taxSummary.shif + taxSummary.housingLevy)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#141e30]">
              <span className="text-slate-300">Trading Gains Reserve (15% Provision)</span>
              <span className="font-mono tabular-nums text-amber-300">{formatCurrency(taxSummary.tradingProvision)}</span>
            </div>
            <div className="flex justify-between py-2 px-3 bg-[#121c2d] rounded-lg font-bold text-white">
              <span>Total Recommended Tax Set-Aside</span>
              <span className="font-mono tabular-nums text-amber-400">
                {formatCurrency(taxSummary.combinedEstimatedTax)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
