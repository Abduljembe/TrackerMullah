import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, Link2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import {
  BROKER_BRIDGE_EVENT,
  BrokerStatusResponse,
  closeBrokerTrade,
  fetchBrokerStatus,
  isBrokerMirrorEnabled,
  reconcileBrokerTradesIntoJournal,
  setBrokerMirrorEnabled,
} from '../../utils/brokerBridge.ts';

interface LiveBrokerBridgeCardProps {
  compact?: boolean;
}

export const LiveBrokerBridgeCard: React.FC<LiveBrokerBridgeCardProps> = ({ compact = false }) => {
  const [status, setStatus] = useState<BrokerStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mirrorEnabled, setMirrorEnabled] = useState<boolean>(() => isBrokerMirrorEnabled());
  const [notice, setNotice] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrokerStatus();
    if (data) setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, 15000);
    const onMirrorEvent = () => setMirrorEnabled(isBrokerMirrorEnabled());
    window.addEventListener(BROKER_BRIDGE_EVENT, onMirrorEvent);
    return () => {
      clearInterval(timer);
      window.removeEventListener(BROKER_BRIDGE_EVENT, onMirrorEvent);
    };
  }, [refreshStatus]);

  const handleToggleMirror = () => {
    const next = !mirrorEnabled;
    setBrokerMirrorEnabled(next);
    setMirrorEnabled(next);
    setNotice(
      next
        ? 'Signal mirroring enabled: auto-opened trades will also route to your connected server broker.'
        : 'Signal mirroring paused: trades execute on your Paper Desk & Journal only.'
    );
    setTimeout(() => setNotice(null), 5000);
  };

  const handleReconcile = async () => {
    setReconciling(true);
    const res = await reconcileBrokerTradesIntoJournal();
    setReconciling(false);
    setNotice(
      res.importedCount > 0
        ? `Reconciled ${res.importedCount} closed fill(s) from ${res.bridge.toUpperCase()} into your Trading Journal.`
        : `Journal is already up to date with ${res.bridge.toUpperCase()}.`
    );
    setTimeout(() => setNotice(null), 5000);
  };

  const handleCloseBrokerTrade = async (tradeId: string) => {
    setClosingId(tradeId);
    const res = await closeBrokerTrade(tradeId);
    setClosingId(null);
    if (res.success) {
      setNotice(`Closed broker ticket #${tradeId}.`);
      refreshStatus();
    } else {
      setNotice(res.error || 'Could not close broker ticket.');
    }
    setTimeout(() => setNotice(null), 4000);
  };

  const bridgeLabel =
    status?.activeBridge === 'oanda'
      ? status.oandaEnv === 'live'
        ? 'OANDA Live Connected'
        : 'OANDA Practice Connected'
      : status?.activeBridge === 'metaapi'
      ? 'MetaApi Cloud MT5 Connected'
      : status?.activeBridge === 'mt5_ea'
      ? 'Desktop MT5 EA Connected'
      : 'Paper Mode (Cloud Broker Standby)';

  return (
    <div className="rounded-2xl bg-[#0b1220] border border-[#172642] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#142036] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#0df2c9]" />
            <h3 className="text-sm sm:text-base font-bold text-white">Live Broker API Bridge</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {bridgeLabel}
            {status?.accountSummary?.maskedAccount ? ` · Acct ${status.accountSummary.maskedAccount}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleMirror}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              mirrorEnabled
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-[#080f1d] border-[#1b2c48] text-slate-300 hover:border-teal-500/40'
            }`}
          >
            {mirrorEnabled ? 'Mirroring Signals: ON' : 'Mirror Signals to Broker'}
          </button>

          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconciling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#112036] hover:bg-[#172b47] border border-teal-500/40 text-[#0df2c9] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>{reconciling ? 'Syncing...' : 'Reconcile Fills'}</span>
          </button>

          <button
            type="button"
            onClick={refreshStatus}
            disabled={loading}
            aria-label="Refresh broker account status"
            className="p-2 rounded-lg bg-[#080f1d] border border-[#1b2c48] hover:border-teal-500/40 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0df2c9]' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs text-teal-200">
          {notice}
        </div>
      )}

      {status?.accountSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
            <div className="text-[11px] text-slate-400">Broker Balance</div>
            <div className="text-base font-bold font-mono tabular-nums text-white mt-0.5">
              {status.accountSummary.currency} {status.accountSummary.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
            <div className="text-[11px] text-slate-400">Live Equity</div>
            <div className="text-base font-bold font-mono tabular-nums text-[#0df2c9] mt-0.5">
              {status.accountSummary.currency} {status.accountSummary.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
            <div className="text-[11px] text-slate-400">Unrealized P&amp;L</div>
            <div
              className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                status.accountSummary.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {status.accountSummary.unrealizedPnl >= 0 ? '+' : ''}
              {status.accountSummary.unrealizedPnl.toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
            <div className="text-[11px] text-slate-400">Open Positions</div>
            <div className="text-base font-bold font-mono tabular-nums text-white mt-0.5">
              {status.accountSummary.openTradeCount}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-[#0df2c9] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Server-Secured Credential Architecture</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                To trade live via OANDA v20 or MetaApi MT5, set <code className="font-mono text-teal-300">OANDA_API_KEY</code> &amp;{' '}
                <code className="font-mono text-teal-300">OANDA_ACCOUNT_ID</code> (or <code className="font-mono text-teal-300">METAAPI_TOKEN</code>) in Server Secrets. Keys never touch your browser.
              </p>
            </div>
          </div>
          {status?.errorDetail && <span className="text-[11px] font-mono text-amber-400 shrink-0">{status.errorDetail}</span>}
        </div>
      )}

      {!compact && status && status.openTrades.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#142036]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#070c16] text-slate-400 font-mono text-[11px] border-b border-[#142036]">
                <th className="py-2 px-3">Ticket / Symbol</th>
                <th className="py-2 px-3">Side</th>
                <th className="py-2 px-3 text-right">Size</th>
                <th className="py-2 px-3 text-right">Entry</th>
                <th className="py-2 px-3 text-right">Floating P&amp;L</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142036] font-mono tabular-nums">
              {status.openTrades.map((tr) => (
                <tr key={tr.id} className="hover:bg-[#0e1728]">
                  <td className="py-2 px-3 text-white font-semibold">
                    {tr.symbol} <span className="text-slate-500 text-[10px]">#{tr.id}</span>
                  </td>
                  <td className={`py-2 px-3 font-semibold ${tr.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tr.direction}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300">{tr.units}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{tr.openPrice}</td>
                  <td className={`py-2 px-3 text-right font-bold ${tr.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tr.unrealizedPnl >= 0 ? '+' : ''}${tr.unrealizedPnl.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      disabled={closingId === tr.id}
                      onClick={() => handleCloseBrokerTrade(tr.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] cursor-pointer"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>{closingId === tr.id ? '...' : 'Close'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
