/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { FinanceProvider, useFinance } from './context/FinanceContext.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { QuickAddModal } from './components/modals/QuickAddModal.tsx';
import { HealthScoreModal } from './components/modals/HealthScoreModal.tsx';
import { ClearDataModal } from './components/modals/ClearDataModal.tsx';
import { CurrencyConverterModal } from './components/modals/CurrencyConverterModal.tsx';
import { BackupRestoreModal } from './components/modals/BackupRestoreModal.tsx';
import { OfflineIndicator } from './components/pwa/OfflineIndicator.tsx';
import { GlobalSignalToast } from './components/common/GlobalSignalToast.tsx';
import { CommandPaletteModal } from './components/common/CommandPaletteModal.tsx';
import { MobileBottomNav } from './components/common/MobileBottomNav.tsx';
import { JarvisAssistant } from './components/jarvis/JarvisAssistant.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { LandingPage } from './components/landing/LandingPage.tsx';

// Code-split views on demand so mobile & Vercel initial bundle stays fast
const DashboardView = lazy(() => import('./components/views/DashboardView.tsx').then((m) => ({ default: m.DashboardView })));
const InsightsView = lazy(() => import('./components/views/InsightsView.tsx').then((m) => ({ default: m.InsightsView })));
const IncomeView = lazy(() => import('./components/views/IncomeView.tsx').then((m) => ({ default: m.IncomeView })));
const ExpensesView = lazy(() => import('./components/views/ExpensesView.tsx').then((m) => ({ default: m.ExpensesView })));
const BudgetView = lazy(() => import('./components/views/BudgetView.tsx').then((m) => ({ default: m.BudgetView })));
const SavingsGoalsView = lazy(() => import('./components/views/SavingsGoalsView.tsx').then((m) => ({ default: m.SavingsGoalsView })));
const EmergencyFundView = lazy(() => import('./components/views/EmergencyFundView.tsx').then((m) => ({ default: m.EmergencyFundView })));
const InvestmentsView = lazy(() => import('./components/views/InvestmentsView.tsx').then((m) => ({ default: m.InvestmentsView })));
const DebtTrackerView = lazy(() => import('./components/views/DebtTrackerView.tsx').then((m) => ({ default: m.DebtTrackerView })));
const FFCalculatorView = lazy(() => import('./components/views/FFCalculatorView.tsx').then((m) => ({ default: m.FFCalculatorView })));
const ReportsView = lazy(() => import('./components/views/ReportsView.tsx').then((m) => ({ default: m.ReportsView })));
const MpesaView = lazy(() => import('./components/views/MpesaView.tsx').then((m) => ({ default: m.MpesaView })));
const TaxCalculatorView = lazy(() => import('./components/views/TaxCalculatorView.tsx').then((m) => ({ default: m.TaxCalculatorView })));
const ChamaView = lazy(() => import('./components/views/ChamaView.tsx').then((m) => ({ default: m.ChamaView })));
const CashflowForecastView = lazy(() => import('./components/views/CashflowForecastView.tsx').then((m) => ({ default: m.CashflowForecastView })));
const MilestonesView = lazy(() => import('./components/views/MilestonesView.tsx').then((m) => ({ default: m.MilestonesView })));
const BillsView = lazy(() => import('./components/views/BillsView.tsx').then((m) => ({ default: m.BillsView })));
const WalletsView = lazy(() => import('./components/views/WalletsView.tsx').then((m) => ({ default: m.WalletsView })));
const SaccoMmfCalculatorView = lazy(() => import('./components/views/SaccoMmfCalculatorView.tsx').then((m) => ({ default: m.SaccoMmfCalculatorView })));
const StockRadarView = lazy(() => import('./components/views/StockRadarView.tsx').then((m) => ({ default: m.StockRadarView })));
const OrderFlowView = lazy(() => import('./components/views/OrderFlowView.tsx').then((m) => ({ default: m.OrderFlowView })));
const LiveTvView = lazy(() => import('./components/views/LiveTvView.tsx').then((m) => ({ default: m.LiveTvView })));
const Mt5EaScalperStudio = lazy(() => import('./components/views/Mt5EaScalperStudio.tsx').then((m) => ({ default: m.Mt5EaScalperStudio })));
const ForexPowerSuiteView = lazy(() => import('./components/views/ForexPowerSuiteView.tsx').then((m) => ({ default: m.ForexPowerSuiteView })));
const BotStudioView = lazy(() => import('./components/views/BotStudioView.tsx').then((m) => ({ default: m.BotStudioView })));
const GoldScalperView = lazy(() => import('./components/views/GoldScalperView.tsx').then((m) => ({ default: m.GoldScalperView })));

const ViewFallback: React.FC = () => (
  <div className="min-h-[280px] flex items-center justify-center">
    <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400">
      <div className="w-5 h-5 border-2 border-[#0df2c9] border-t-transparent rounded-full animate-spin" />
      <span>Loading workspace module...</span>
    </div>
  </div>
);

const MainContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { activeTab, appRefreshKey } = useFinance();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono text-slate-400">Loading NjiaFedha Security Vault...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage initialMode="login" />
        <AuthModal />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'insights':
        return <InsightsView />;
      case 'cashflow':
        return <CashflowForecastView />;
      case 'income':
        return <IncomeView />;
      case 'expenses':
        return <ExpensesView />;
      case 'wallets':
        return <WalletsView />;
      case 'bills':
        return <BillsView />;
      case 'budget':
        return <BudgetView />;
      case 'mpesa':
        return <MpesaView />;
      case 'savings':
        return <SavingsGoalsView />;
      case 'emergency':
        return <EmergencyFundView />;
      case 'investments':
        return <InvestmentsView />;
      case 'stocks':
        return <StockRadarView />;
      case 'gold-scalper':
        return <GoldScalperView />;
      case 'bot-studio':
        return <BotStudioView />;
      case 'mt5-ea':
        return <Mt5EaScalperStudio />;
      case 'forex-suite':
        return <ForexPowerSuiteView />;
      case 'orderflow':
        return <OrderFlowView />;
      case 'livetv':
        return <LiveTvView />;
      case 'sacco-mmf':
        return <SaccoMmfCalculatorView />;
      case 'debt':
        return <DebtTrackerView />;
      case 'chama':
        return <ChamaView />;
      case 'milestones':
        return <MilestonesView />;
      case 'tax':
        return <TaxCalculatorView />;
      case 'calculator':
        return <FFCalculatorView />;
      case 'reports':
        return <ReportsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 w-full overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-w-0 w-full fintech-grid-bg transition-all duration-300">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main key={appRefreshKey} className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 w-full min-w-0 pb-24 md:pb-16">
          <Suspense fallback={<ViewFallback />}>{renderActiveView()}</Suspense>
        </main>
      </div>

      {/* Global Modals & Navigation */}
      <QuickAddModal />
      <HealthScoreModal />
      <ClearDataModal />
      <CurrencyConverterModal />
      <BackupRestoreModal />
      <CommandPaletteModal />
      <AuthModal />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />

      {/* Global Signal Hit Notifications */}
      <GlobalSignalToast />

      {/* Mullah Audio AI Copilot */}
      <JarvisAssistant />

      {/* PWA Network Status Alert */}
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <MainContent />
      </FinanceProvider>
    </AuthProvider>
  );
}
