import { Check, ArrowDownToLine, Printer, Landmark, Calendar, Info, Share2, Clipboard } from 'lucide-react';
import { Transaction, BankAccount } from '../types';

interface ReceiptProps {
  transaction: Transaction;
  bankAccount?: BankAccount;
  onClose: () => void;
}

export default function Receipt({ transaction, bankAccount, onClose }: ReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const copyRefNo = () => {
    navigator.clipboard.writeText(transaction.refNo);
    alert('AMITCASH Reference Number copied!');
  };

  const formattedDate = new Date(transaction.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div id="upi-receipt-card" className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto animate-fade-in print:shadow-none print:border-none">
        
        {/* Colorful Success Header */}
        <div className="bg-emerald-600 text-white p-6 text-center relative overflow-hidden flex flex-col items-center">
          {/* Subtle background abstract elements */}
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-500/20 pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full bg-emerald-500/20 pointer-events-none" />

          <div className="w-14 h-14 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-lg mb-3 animate-ping-once">
            <Check className="w-7 h-7 stroke-[3px]" />
          </div>
          
          <h4 className="font-sans font-bold text-lg uppercase tracking-wider text-emerald-100">Payment Successful</h4>
          
          <div className="text-3xl font-bold font-sans mt-2 inline-flex items-baseline">
            <span className="text-lg font-semibold text-emerald-200 mr-0.5">₹</span>
            {transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>

          <p className="text-emerald-100 text-[10px] uppercase font-mono tracking-widest mt-1">AMITCASH SYSTEM</p>
        </div>

        {/* Transaction Meta Details */}
        <div className="p-5 flex-1 divide-y divide-slate-100 text-slate-700 bg-white">
          
          {/* Payee Details */}
          <div className="pb-4">
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mb-1">To (Payee)</p>
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-sans font-bold text-slate-900 text-sm leading-tight">{transaction.name}</h5>
                <p className="font-mono text-xs text-slate-500 italic mt-0.5">{transaction.upiId}</p>
              </div>
              <span className="text-[11px] bg-sky-50 text-indigo-600 font-semibold px-2.5 py-1 rounded-full border border-sky-100">
                Verified Sign
              </span>
            </div>
          </div>

          {/* Source Account Info */}
          <div className="py-4">
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mb-1">From (Bank)</p>
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: bankAccount?.logoColor || '#4f46e5' }}
              >
                <Landmark className="w-4.5 h-4.5" />
              </div>
              <div>
                <h5 className="font-sans font-semibold text-slate-900 text-xs">{transaction.bankName}</h5>
                <p className="text-[10px] text-slate-500 font-medium">Debited Account {bankAccount?.accountNumber || '•••• 4812'}</p>
              </div>
            </div>
          </div>

          {/* Reference & Date Records */}
          <div className="py-4 space-y-2.5">
            <div className="flex justify-between items-start text-xs">
              <span className="text-slate-400 font-medium">Transaction Date</span>
              <span className="font-medium text-slate-800 text-right flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedDate}
              </span>
            </div>

            <div className="flex justify-between items-start text-xs">
              <span className="text-slate-400 font-medium">NPCI Ref Number</span>
              <span className="font-mono font-bold text-slate-900 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                {transaction.refNo}
                <button 
                  onClick={copyRefNo}
                  className="hover:text-emerald-600 p-0.5 focus:outline-none transition-colors"
                  title="Copy reference number"
                >
                  <Clipboard className="w-3 h-3 text-slate-400" />
                </button>
              </span>
            </div>

            {transaction.remarks && (
              <div className="flex justify-between items-start text-xs">
                <span className="text-slate-400 font-medium">Note / Remarks</span>
                <span className="font-medium text-slate-700 text-right italic font-sans">
                  "{transaction.remarks}"
                </span>
              </div>
            )}
            
            <div className="flex justify-between items-start text-xs">
              <span className="text-slate-400 font-medium">Payment Status</span>
              <span className="text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                SUCCESS
              </span>
            </div>
          </div>

          {/* Security stamp warning */}
          <div className="pt-4 pb-2 text-center bg-slate-50 rounded-2xl p-3 border border-slate-100 mt-2">
            <div className="flex items-center justify-center gap-1.5 text-slate-500">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-medium leading-relaxed">
                This is a secure electronic receipt generated natively via AMITCASH secure architecture. No physical signature needed.
              </span>
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-sans font-semibold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1 text-xs shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Receipt
          </button>
          
          <button
            onClick={onClose}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-sans font-semibold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1 text-xs shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
