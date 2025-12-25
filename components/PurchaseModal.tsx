import React from 'react';
import { Lock, Crown, X } from 'lucide-react';

interface Props {
  title: string;
  price: number;
  userBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PurchaseModal: React.FC<Props> = ({ title, price, userBalance, onConfirm, onCancel }) => {
  const canAfford = userBalance >= price;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
            <X size={20} />
        </button>
        
        <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 shadow-inner">
                {canAfford ? <Crown size={32} fill="currentColor" /> : <Lock size={32} />}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Unlock Content?</h3>
            <p className="text-sm text-slate-500 font-medium px-4">{title}</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
            <div className="flex justify-between items-center mb-2 text-sm">
                <span className="text-slate-500 font-bold">Your Balance</span>
                <span className="font-mono font-bold text-slate-700">{userBalance} Cr</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-bold">Cost</span>
                <span className="font-mono font-bold text-red-600">-{price} Cr</span>
            </div>
        </div>

        {canAfford ? (
            <button 
                onClick={onConfirm} 
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
                <Crown size={18} fill="currentColor" /> UNLOCK NOW
            </button>
        ) : (
            <div className="space-y-3">
                <button disabled className="w-full py-3 bg-slate-200 text-slate-400 font-bold rounded-xl cursor-not-allowed">
                    Insufficient Credits
                </button>
                <p className="text-xs text-center text-red-500 font-bold">You need {price - userBalance} more credits.</p>
            </div>
        )}
      </div>
    </div>
  );
};
