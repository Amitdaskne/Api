import React, { useState } from 'react';
import { 
  Search, Eye, EyeOff, Landmark, Send, ArrowUpRight, ArrowDownLeft, 
  Clock, CheckCircle2, XCircle, ArrowRight, ShieldCheck, HelpCircle,
  RefreshCw, Sparkles, QrCode, Smartphone, Coins, Lock, Check, Delete
} from 'lucide-react';
import { UserProfile, Transaction, Payee, BankAccount } from '../types';

interface DashboardProps {
  userProfile: UserProfile;
  transactions: Transaction[];
  payees: Payee[];
  onSelectPayee: (payee: Payee) => void;
  onSelectBank: (bankId: string) => void;
  onInitiateRawUpi: (upiId: string) => void;
  onViewReceipt: (tx: Transaction) => void;
  // Callback directly back to Firestore to support dynamic balance credits
  onSimulateReceive: (amount: number, bankId: string, senderName: string, senderUpi: string) => Promise<void>;
}

export default function Dashboard({
  userProfile,
  transactions,
  payees,
  onSelectPayee,
  onSelectBank,
  onInitiateRawUpi,
  onViewReceipt,
  onSimulateReceive
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rawUpiInput, setRawUpiInput] = useState<string>('');
  const [rawUpiError, setRawUpiError] = useState<string>('');
  const [txFilter, setTxFilter] = useState<'ALL' | 'SEND' | 'RECEIVE'>('ALL');

  // "User has to use pin to see balance" state management
  const [unlockedBalances, setUnlockedBalances] = useState<Record<string, boolean>>({});
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [currentVerificationBankId, setCurrentVerificationBankId] = useState<string | null>(null);
  const [typedVerificationPin, setTypedVerificationPin] = useState<string>('');
  const [pinVerificationError, setPinVerificationError] = useState<string>('');
  const [shuffleBalanceKeys, setShuffleBalanceKeys] = useState<boolean>(true);
  const [balanceKeypad, setBalanceKeypad] = useState<string[]>(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);

  // Scramble check-balance keypad keys
  React.useEffect(() => {
    if (showPinModal) {
      const defaultKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
      if (shuffleBalanceKeys) {
        const scrambled = [...defaultKeys];
        for (let i = scrambled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
        }
        setBalanceKeypad(scrambled);
      } else {
        setBalanceKeypad(defaultKeys);
      }
    }
  }, [showPinModal, shuffleBalanceKeys]);

  // Peer Simulation Faucet states (kept behind-the-scenes for internal logic)
  const [showFaucetModal, setShowFaucetModal] = useState<boolean>(false);
  const [faucetAmount, setFaucetAmount] = useState<number>(500);
  const [faucetSenderName, setFaucetSenderName] = useState<string>('Amit Kumar');
  const [faucetSenderUpi, setFaucetSenderUpi] = useState<string>('amitkumar@paytm');
  const [faucetLoading, setFaucetLoading] = useState<boolean>(false);
  const [faucetSuccessMsg, setFaucetSuccessMsg] = useState<string>('');

  const handleRawUpiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRawUpiError('');
    const trimmed = rawUpiInput.trim();
    if (!trimmed) return;

    if (!trimmed.includes('@')) {
      setErrorAndClear('Please enter a valid UPI address containing "@" (e.g., name@amitcash)');
      return;
    }

    onInitiateRawUpi(trimmed);
  };

  const setErrorAndClear = (msg: string) => {
    setRawUpiError(msg);
    setTimeout(() => {
      setRawUpiError('');
    }, 4000);
  };

  // Launch security check for seeing balances
  const triggerBalanceCheck = (bankId: string) => {
    if (unlockedBalances[bankId]) {
      // If already visible, toggle it back to hidden (no PIN needed to hide)
      setUnlockedBalances(prev => ({ ...prev, [bankId]: false }));
    } else {
      // Must prompt for secure 4-digit PIN setup
      setCurrentVerificationBankId(bankId);
      setTypedVerificationPin('');
      setPinVerificationError('');
      setShowPinModal(true);
    }
  };

  // Click handlers for balance PINpad
  const handleBalancePinKeyPress = (num: string) => {
    setPinVerificationError('');
    if (typedVerificationPin.length < 4) {
      setTypedVerificationPin(prev => prev + num);
    }
  };

  const handleBalancePinDelete = () => {
    setPinVerificationError('');
    setTypedVerificationPin(prev => prev.slice(0, -1));
  };

  const handleBalancePinClear = () => {
    setPinVerificationError('');
    setTypedVerificationPin('');
  };

  // Verify PIN matches profile configuration
  const handlePinVerificationSubmit = () => {
    if (!currentVerificationBankId) return;

    const expectedPin = userProfile.appPin || '1234'; 
    if (typedVerificationPin === expectedPin) {
      setUnlockedBalances(prev => ({
        ...prev,
        [currentVerificationBankId]: true
      }));
      setShowPinModal(false);
      setTypedVerificationPin('');
    } else {
      setPinVerificationError('Incorrect security credentials keys. Please try again.');
      setTypedVerificationPin('');
    }
  };

  // Seed deposits to simulate "amount increase on receive"
  const handleTriggerFaucet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faucetSenderName.trim() || !faucetSenderUpi.trim()) return;
    if (faucetAmount <= 0) return;

    try {
      setFaucetLoading(true);
      const targetBankId = userProfile.activeBankId || 'amit-bank';
      await onSimulateReceive(faucetAmount, targetBankId, faucetSenderName.trim(), faucetSenderUpi.trim());
      
      setFaucetSuccessMsg(`Successfully credited +₹${faucetAmount.toLocaleString('en-IN')}! Check your Passbook.`);
      setTimeout(() => {
        setFaucetSuccessMsg('');
        setShowFaucetModal(false);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Simulation error.');
    } finally {
      setFaucetLoading(false);
    }
  };

  const getSelectablePaymentSources = (): BankAccount[] => {
    return userProfile.bankAccounts || [];
  };

  const paymentSources = getSelectablePaymentSources();

  // Filter transaction records
  const filteredTxs = transactions.filter(tx => {
    const matchesFilter = 
      txFilter === 'ALL' || 
      (txFilter === 'SEND' && tx.type === 'SEND') || 
      (txFilter === 'RECEIVE' && tx.type === 'RECEIVE');

    const searchStr = `${tx.name} ${tx.upiId} ${tx.refNo} ${tx.remarks || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">

      {/* SECTION 1: PAYTM EMBLEM QUICK TRANSFER BAR */}
      <div className="bg-gradient-to-br from-[#002E6E] via-[#001D4A] to-[#000E29] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        
        {/* Abstract vector backgrounds */}
        <div className="absolute right-0 top-0 w-44 h-44 bg-[#00baf2]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-5 mb-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#00baf2]/20 text-[#00baf2] border border-[#00baf2]/30 rounded text-[10px] font-bold uppercase tracking-widest leading-none mb-2">
              <Sparkles className="w-3 h-3 text-yellow-300" /> Paytm style premium engine
            </div>
            <h2 className="font-sans font-black text-xl tracking-tight text-white leading-tight">
              AMITCASH Pay & Transfer
            </h2>
            <p className="text-slate-300 text-xs mt-1">Instant Money Settlements with bank level grade security.</p>
          </div>
        </div>

        {/* Paytm standard 4 quick action circles */}
        <div className="grid grid-cols-4 gap-2 relative z-10">
          
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#00baf2] hover:bg-[#00a3d4] flex items-center justify-center text-white cursor-pointer transition-transform duration-200 active:scale-95 shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-200 mt-2">Scan & Pay</span>
          </div>

          <a href="#quick-contacts" className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white cursor-pointer transition-transform duration-200 active:scale-95 shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-200 mt-2">To Contact</span>
          </a>

          <a href="#direct-bank-pay" className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white cursor-pointer transition-transform duration-200 active:scale-95 shadow-md">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-200 mt-2">To UPI Handle</span>
          </a>

          <div 
            onClick={() => triggerBalanceCheck('amit-bank')}
            className="flex flex-col items-center text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white cursor-pointer transition-transform duration-200 active:scale-95 shadow-md">
              <Landmark className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-200 mt-2">Check Balance</span>
          </div>

        </div>

      </div>

      {/* SECTION 2: PASSBOOK / BANK ACCOUNTS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Account Cards panel */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-indigo-650" />
            Passbook & Associated Payment Accounts
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {paymentSources.map((source) => {
              const isCryptoWallet = source.id === 'wallet';
              const isSelected = source.id === userProfile.activeBankId;
              const isVerifiedVisible = !!unlockedBalances[source.id];

              return (
                <div
                  key={source.id}
                  onClick={() => onSelectBank(source.id)}
                  className={`relative p-5 rounded-3xl border cursor-pointer transition-all ${
                    isCryptoWallet
                      ? 'bg-gradient-to-br from-[#002E6E] to-slate-950 text-white border-blue-500/10 shadow-lg'
                      : 'bg-white text-slate-800 border-slate-100 hover:border-indigo-200 shadow-sm'
                  } ${
                    isSelected 
                      ? 'ring-2 ring-[#00baf2] ring-offset-2' 
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md"
                        style={{ backgroundColor: source.logoColor }}
                      >
                        {source.bankName.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <h5 className={`font-sans font-black text-xs leading-none line-clamp-1 ${isCryptoWallet ? 'text-white' : 'text-slate-800'}`}>
                          {source.bankName}
                        </h5>
                        <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                          {source.accountNumber}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-505/10 text-emerald-400 border border-emerald-500/20">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-400 uppercase">
                        Primary
                      </span>
                    )}
                  </div>

                  {/* Balance details (Protected by 4-digit security app PIN!) */}
                  <div className={`mt-5 pt-3 border-t flex justify-between items-center ${isCryptoWallet ? 'border-white/10' : 'border-slate-100'}`}>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Available Balance</p>
                      <div className="font-sans font-black text-sm mt-0.5">
                        {isVerifiedVisible ? (
                          <span className={isCryptoWallet ? 'text-yellow-400' : 'text-slate-950'}>
                            ₹{source.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400 tracking-wider">••••••</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerBalanceCheck(source.id);
                      }}
                      className={`p-1.5 rounded-full transition-colors focus:outline-none cursor-pointer ${
                        isCryptoWallet ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                      }`}
                      title={isVerifiedVisible ? 'Hide Balance' : 'Enter PIN to View Balance'}
                    >
                      {isVerifiedVisible ? (
                        <EyeOff className="w-4.5 h-4.5" />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Eye className="w-4.5 h-4.5" />
                          <span className="text-[10px] font-extrabold text-[#00baf2] hover:underline">Check A/c</span>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Direct payment sidebar widget */}
        <div id="direct-bank-pay" className="space-y-4">
          <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight">
            Direct Address Pay
          </h4>
          
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
            <p className="text-xs text-slate-500 leading-normal">
              Type any recipient's UPI address to dispatch funds securely from your active balance sources.
            </p>

            <form onSubmit={handleRawUpiSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. friend@amitcash"
                  value={rawUpiInput}
                  onChange={(e) => setRawUpiInput(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 focus:border-[#00baf2] focus:bg-white rounded-xl py-3 px-4 text-slate-800 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!rawUpiInput}
                className="w-full bg-[#002E6E] hover:bg-[#001D4A] disabled:opacity-40 text-white font-sans font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider transition-colors shadow-sm shrink-0 cursor-pointer"
              >
                Verify & Pay Recipient
              </button>

              {rawUpiError && (
                <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  {rawUpiError}
                </p>
              )}
            </form>
          </div>
        </div>

      </div>

      {/* SECTION 3: QUICK CONTACT LIST */}
      <div id="quick-contacts">
        <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight mb-3">
          Quick Contacts / Transfer Hub
        </h4>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
          {payees.map((payee) => (
            <button
              key={payee.id}
              onClick={() => onSelectPayee(payee)}
              className="flex flex-col items-center justify-center space-y-1.5 shrink-0 bg-white hover:bg-indigo-50/20 border border-slate-100 rounded-2xl p-4 w-28 snap-start transition-all shadow-sm cursor-pointer group"
            >
              {/* Profile icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs group-hover:scale-105 transition-transform"
                style={{ backgroundColor: payee.avatarColor }}
              >
                {payee.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
              </div>
              <span className="font-sans font-black text-slate-800 text-[11px] truncate w-full text-center">
                {payee.name}
              </span>
              <span className="text-[9px] text-[#00baf2] font-mono tracking-tight truncate w-full text-center">
                {payee.upiId}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4: TRANSFER LOGS TABLE */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h4 className="font-sans font-black text-slate-900 text-base flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-indigo-500" />
              Paytm-Style Secure Passbook Logs
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Settled, pending and instant merchant ledger activities</p>
          </div>

          {/* Filter operations */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative shrink-0 w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search recipient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8.5 py-2 text-slate-800 outline-none focus:bg-white focus:border-[#00baf2] transition-all"
              />
            </div>

            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-100">
              {(['ALL', 'SEND', 'RECEIVE'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-colors cursor-pointer ${
                    txFilter === f 
                      ? 'bg-[#002E6E] text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-850'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'SEND' ? 'Paid' : 'Received'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTxs.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {filteredTxs.map((tx) => {
              const isDebit = tx.type === 'SEND';
              
              return (
                <div 
                  key={tx.id} 
                  className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-xl px-2 transition-colors cursor-pointer group"
                  onClick={() => onViewReceipt(tx)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isDebit 
                        ? 'bg-amber-50 text-amber-700' 
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>

                    <div>
                      <h5 className="font-sans font-black text-slate-850 text-xs">
                        {tx.name}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {tx.upiId} • <span className="font-sans font-medium">{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </p>
                      {tx.remarks && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">"{tx.remarks}"</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className={`font-sans font-black text-xs ${isDebit ? 'text-slate-800' : 'text-emerald-600'}`}>
                        {isDebit ? '-' : '+'} ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-wider font-sans">{tx.bankName}</p>
                    </div>

                    <span className="text-[10px] font-semibold text-[#00baf2] group-hover:underline flex items-center gap-0.5">
                      View
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400 flex flex-col items-center">
            <Clock className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold">No transactions recorded yet</p>
            <p className="text-[10px] mt-0.5 text-slate-400">Scan QR codes or check balance to populate.</p>
          </div>
        )}
      </div>

      {/* OVERLAY A: "User has to use pin to see balance" ENQUIRY PIN KEYPAD MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            
            {/* UPI Secure Banner */}
            <div className="bg-[#002E6E] text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span className="font-mono text-[10px] font-bold tracking-wider text-teal-400">AMITCASH • SECURE BALANCE ENTRY</span>
              </div>
              <button 
                onClick={() => setShowPinModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-755 transition-colors"
              >
                <span className="text-xs">&times;</span>
              </button>
            </div>

            {/* Account Information Summary */}
            <div className="bg-slate-50 p-5 border-b border-slate-100 text-center">
              <p className="text-[10px] text-slate-500 font-bold tracking-tight uppercase">PROTECTED BANK SERVICE</p>
              <h4 className="font-sans font-black text-slate-850 text-sm mt-1">Check Balance Enquiry</h4>
              
              <div className="mt-3.5 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-left text-xs text-slate-600">
                <div>
                  <p className="font-bold text-slate-800">AMIT PAYMENTS BANK</p>
                  <p className="text-[10px] text-slate-400">•••• 1988 • SAVINGS</p>
                </div>
                <div className="w-3.5 h-3.5 rounded-full bg-[#002E6E]" />
              </div>
            </div>

            {/* Pin Dots Display Area */}
            <div className="py-6 flex flex-col items-center justify-center bg-white">
              <p className="text-xs font-semibold text-slate-700 mb-3">
                Enter 4-Digit UPI PIN <span className="text-indigo-500 font-bold">(Hint: 1234)</span>
              </p>
              
              {/* Masked circles dots */}
              <div className="flex gap-4 justify-center mb-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      i < typedVerificationPin.length
                        ? 'bg-[#002E6E] border-[#002E6E] scale-110'
                        : 'bg-transparent border-slate-300'
                    }`}
                  />
                ))}
              </div>

              {pinVerificationError && (
                <div className="px-5 text-center flex items-center justify-center gap-1 text-red-500 mt-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-bold leading-relaxed">{pinVerificationError}</span>
                </div>
              )}
            </div>

            {/* Shuffling Setting Option */}
            <div className="px-5 pb-2 pt-0.5 flex justify-between items-center text-slate-500 bg-white border-t border-slate-100">
              <span className="text-[9px] font-bold text-slate-400">Scramble keypad for extra security</span>
              <button
                type="button"
                onClick={() => setShuffleBalanceKeys(!shuffleBalanceKeys)}
                className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-all ${
                  shuffleBalanceKeys 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {shuffleBalanceKeys ? 'SHUFFLE: ON' : 'SHUFFLE: OFF'}
              </button>
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-0 bg-slate-50 p-2 border-t border-slate-100">
              {balanceKeypad.slice(0, 9).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleBalancePinKeyPress(num)}
                  className="py-3.5 text-center font-sans font-bold text-base text-slate-800 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none cursor-pointer"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handleBalancePinClear}
                className="py-3.5 text-center font-mono text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors uppercase focus:outline-none cursor-pointer"
              >
                Clear
              </button>
              
              <button
                type="button"
                onClick={() => handleBalancePinKeyPress(balanceKeypad[9])}
                className="py-3.5 text-center font-sans font-bold text-base text-slate-800 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none cursor-pointer"
              >
                {balanceKeypad[9]}
              </button>

              <button
                type="button"
                onClick={handleBalancePinDelete}
                className="py-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Submit Action Button */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-sans font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handlePinVerificationSubmit}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-teal-400 font-sans font-black py-2.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                UNLOCK
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OVERLAY B: SIMULATED PEER CREDITS FAUCET MODAL */}
      {showFaucetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-slate-800">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
                <Coins className="w-6 h-6" />
              </div>
              <h4 className="font-sans font-black text-slate-900 text-sm">Simulate Receiver Deposit</h4>
              <p className="text-[10px] text-slate-400 mt-1">Simulate a peer transferring funds to your account instantly.</p>
            </div>

            {faucetSuccessMsg ? (
              <div className="py-4 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-emerald-600 font-sans">{faucetSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleTriggerFaucet} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Select simulated amount to increase</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[100, 500, 2000, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFaucetAmount(amt)}
                        className={`py-2 text-xs font-black border rounded-xl cursor-pointer ${
                          faucetAmount === amt 
                            ? 'border-[#00baf2] bg-blue-50 text-blue-600' 
                            : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Simulated Sender Name</label>
                  <input
                    type="text"
                    required
                    value={faucetSenderName}
                    onChange={(e) => setFaucetSenderName(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Simulated Sender UPI ID</label>
                  <input
                    type="text"
                    required
                    value={faucetSenderUpi}
                    onChange={(e) => setFaucetSenderUpi(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFaucetModal(false)}
                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={faucetLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    {faucetLoading ? 'Processing...' : 'Deposit Amount'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
