import React from 'react';
import { LayoutDashboard, FileText, Mic, BarChart2, Tv } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useFinance();

  const handleMullahMic = () => {
    window.dispatchEvent(new CustomEvent('njia-mullah-activate-mic'));
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#08101c]/95 border-t border-[#162844] backdrop-blur-lg px-2 py-1.5 flex items-center justify-around"
    >
      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium cursor-pointer ${
          activeTab === 'dashboard' ? 'text-[#0df2c9]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Home</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('expenses')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium cursor-pointer ${
          activeTab === 'expenses' ? 'text-[#0df2c9]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <FileText className="w-4 h-4" />
        <span>Expenses</span>
      </button>

      <button
        type="button"
        onClick={handleMullahMic}
        aria-label="Activate Mullah Voice"
        className="-mt-4 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-teal-500 to-cyan-400 text-[#041018] shadow-[0_0_22px_rgba(13,242,201,0.45)] border-2 border-[#08101c] active:scale-95 transition-transform cursor-pointer"
      >
        <Mic className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('stocks')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium cursor-pointer ${
          activeTab === 'stocks' || activeTab === 'gold-scalper' || activeTab === 'forex-suite'
            ? 'text-[#0df2c9]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart2 className="w-4 h-4" />
        <span>Markets</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('livetv')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium cursor-pointer ${
          activeTab === 'livetv' ? 'text-[#0df2c9]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Tv className="w-4 h-4" />
        <span>Live TV</span>
      </button>
    </nav>
  );
};
