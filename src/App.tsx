import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, Sparkles, QrCode, LogOut, Shield, RefreshCw 
} from 'lucide-react';
import { UserProfile, Transaction, Payee, BankAccount, DecodedUpiContent } from './types';
import { generateRefNo } from './utils/upi';
import Dashboard from './components/Dashboard';
import CameraScanner from './components/CameraScanner';
import InitiatePayment from './components/InitiatePayment';
import PinPad from './components/PinPad';
import Receipt from './components/Receipt';
import GenerateQR from './components/GenerateQR';
import GenerateCodes from './components/GenerateCodes';
import Auth from './components/Auth';
import PinLock from './components/PinLock';
import EmailVerificationScreen from './components/EmailVerificationScreen';

// Firebase core SDK references
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  doc, onSnapshot, updateDoc, collection, addDoc, query, where, getDocs, setDoc 
} from 'firebase/firestore';

const DEFAULT_PAYEES: Payee[] = [
  {
    id: 'p-1',
    name: 'Aarav Sharma',
    upiId: 'aarav.sharma@paytm',
    phone: '+91 98765 43210',
    avatarColor: '#4f46e5',
  },
  {
    id: 'p-2',
    name: 'Priya Patel',
    upiId: 'priya.patel@amitcash',
    phone: '+91 87654 32109',
    avatarColor: '#ec4899',
  },
  {
    id: 'p-3',
    name: 'Rohan Deshmukh',
    upiId: 'rohan.desh@oksbi',
    phone: '+91 76543 21098',
    avatarColor: '#10b981',
  },
  {
    id: 'p-4',
    name: 'Sharma Tea Tapri',
    upiId: 'sharmatea@upi',
    phone: '+91 91234 56789',
    avatarColor: '#f59e0b',
    isMerchant: true,
  },
  {
    id: 'p-5',
    name: 'Supermart Retail',
    upiId: 'supermart@hdfc',
    phone: '+91 81234 56789',
    avatarColor: '#06b6d4',
    isMerchant: true,
  }
];

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'CREATE_QR' | 'GENERATE_CODES'>('DASHBOARD');

  // Firebase Auth states
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Lockscreen verification code
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Firestore profile and transaction list records
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payees, setPayees] = useState<Payee[]>(DEFAULT_PAYEES);

  // Transfer Flow State triggers
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [activePaymentParams, setActivePaymentParams] = useState<DecodedUpiContent | null>(null);
  
  // PIN Pad triggers
  const [pinPadConfig, setPinPadConfig] = useState<{
    bankAccount: BankAccount;
    amount: number;
    remarks: string;
    payeeName: string;
    payeeUpi: string;
  } | null>(null);

  // Processing transition loader
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<'VERIFYING' | 'ROUTING' | 'SUCCESS' | null>(null);
  
  // Final receipt target
  const [viewingReceiptTx, setViewingReceiptTx] = useState<Transaction | null>(null);

  // Sync Auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Firestore profile document in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }

    const docPath = `users/${firebaseUser.uid}`;
    const unsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        
        // Auto-migrate to strictly keep ONLY AMIT PAYMENTS BANK
        const hasExclusiveAmitBank = data.bankAccounts && data.bankAccounts.length === 1 && data.bankAccounts[0].id === 'amit-bank';
        if (!hasExclusiveAmitBank) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          // Set starting balance of 50.00 if it was anything else or if it's new
          const currentBalance = data.balance !== undefined ? data.balance : 50.00;
          const defaultBanks = [
            {
              id: 'amit-bank',
              bankName: 'AMIT PAYMENTS BANK',
              accountNumber: '•••• 1988',
              ifsc: 'AMIT0001988',
              balance: currentBalance,
              upiPin: '1234',
              bankType: 'SAVINGS' as const,
              logoColor: '#002E6E',
            }
          ];
          updateDoc(userRef, {
            bankAccounts: defaultBanks,
            activeBankId: 'amit-bank',
            balance: currentBalance
          }).catch(err => console.error('Auto migration failed:', err));
        }

        setProfile(data);
      } else {
        console.warn('UserProfile document not initialized in Firestore yet.');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, docPath);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Sync user transactions in real-time from Firestore
  useEffect(() => {
    if (!firebaseUser) {
      setTransactions([]);
      return;
    }

    const txCollectionPath = 'transactions';
    const q = query(
      collection(db, txCollectionPath),
      where('userId', '==', firebaseUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (querySnap) => {
      const logs: Transaction[] = [];
      querySnap.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as Transaction);
      });

      // Sort desc by date
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Seed starter transactions if completely empty so the UI looks stunning!
      if (logs.length === 0 && profile) {
        try {
          const starterLogs = [
            {
              type: 'RECEIVE',
              name: 'Aditya Roy',
              upiId: 'aditya.roy@amitcash',
              amount: 120.00,
              status: 'SUCCESS',
              date: new Date(Date.now() - 3600000 * 2).toISOString(),
              refNo: '315721489052',
              remarks: 'Dinner Split',
              bankName: 'AMIT PAYMENTS BANK',
              userId: firebaseUser.uid
            },
            {
              type: 'SEND',
              name: 'Sharma Tea Tapri',
              upiId: 'sharmatea@upi',
              amount: 15.00,
              status: 'SUCCESS',
              date: new Date(Date.now() - 3600000 * 48).toISOString(),
              refNo: '315891482012',
              remarks: 'Tea & Samosas',
              bankName: 'AMIT PAYMENTS BANK',
              userId: firebaseUser.uid
            }
          ];

          for (const rawTx of starterLogs) {
            await addDoc(collection(db, 'transactions'), rawTx);
          }
        } catch (seedErr) {
          console.error('Failed to seed starter transaction logs:', seedErr);
        }
      } else {
        setTransactions(logs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, txCollectionPath);
    });

    return () => unsubscribe();
  }, [firebaseUser, profile]);

  // Log lists to local storage to persist payee definitions
  useEffect(() => {
    if (profile) {
      localStorage.setItem(`upi_payees_${firebaseUser?.uid}`, JSON.stringify(payees));
    }
  }, [payees, profile]);

  // Authenticate signoff wrapper
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setIsUnlocked(false); // Relock the workspace
    } catch (err) {
      console.error('Logout failure:', err);
    }
  };

  // Handle active banking selection (always amit-bank in this simplified mode)
  const selectBank = async (bankId: string) => {
    if (!firebaseUser || !profile) return;

    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      await updateDoc(userRef, {
        activeBankId: bankId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  // Peer-to-peer receive simulation handler to dynamically increase balance
  const handleSimulateReceive = async (amount: number, bankId: string, senderName: string, senderUpi: string) => {
    if (!firebaseUser || !profile) return;
    
    const userRef = doc(db, 'users', firebaseUser.uid);
    const refNo = generateRefNo();
    
    try {
      const updatedAccounts = profile.bankAccounts.map(b => {
        if (b.id === 'amit-bank') {
          return {
            ...b,
            balance: b.balance + amount
          };
        }
        return b;
      });
      const newBalance = (profile.balance !== undefined ? profile.balance : 50.00) + amount;

      await updateDoc(userRef, {
        bankAccounts: updatedAccounts,
        balance: newBalance
      });

      // Record transaction
      const newTxData = {
        type: 'RECEIVE' as const,
        name: senderName,
        upiId: senderUpi,
        amount,
        status: 'SUCCESS' as const,
        date: new Date().toISOString(),
        refNo,
        remarks: 'Simulated Peer Transfer Credit',
        bankName: 'AMIT PAYMENTS BANK',
        userId: firebaseUser.uid
      };
      
      await addDoc(collection(db, 'transactions'), newTxData);

    } catch (err) {
      console.error('Simulation error crediting received funds:', err);
    }
  };

  // Handle linking a new bank (fallback, only links AMIT PAYMENTS BANK)
  const handleAddBankAccount = async (bankName: string, bankType: 'SAVINGS' | 'CURRENT', pin: string) => {
    if (!firebaseUser || !profile) return;

    const nextBank: BankAccount = {
      id: 'amit-bank',
      bankName: 'AMIT PAYMENTS BANK',
      bankType,
      accountNumber: '•••• 1988',
      ifsc: 'AMIT0001988',
      balance: 50.00,
      upiPin: pin,
      logoColor: '#002E6E',
    };

    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      await updateDoc(userRef, {
        bankAccounts: [nextBank],
        activeBankId: 'amit-bank'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  // Launch transfer flow for a payee contact
  const initiatePayeePayment = (payee: Payee) => {
    setActivePaymentParams({
      pa: payee.upiId,
      pn: payee.name,
      am: undefined, // Let user enter amount
    });
  };

  // Launch transfer flow for raw typed UPI Address
  const initiateRawAddressPayment = (upiId: string) => {
    setActivePaymentParams({
      pa: upiId,
      pn: upiId.split('@')[0], 
    });
  };

  // Success QR scan callback
  const handleQrScanSuccess = (params: DecodedUpiContent) => {
    setIsScannerOpen(false);
    setActivePaymentParams(params);
  };

  // Advance from formulation payment sheet to secure PIN pad
  const handleProceedToPin = (amount: number, remarks: string, selectedBank: BankAccount) => {
    if (!activePaymentParams) return;
    setPinPadConfig({
      bankAccount: selectedBank,
      amount,
      remarks,
      payeeName: activePaymentParams.pn || 'Verified Recipient',
      payeeUpi: activePaymentParams.pa,
    });
    setActivePaymentParams(null); 
  };

  // Process the final transaction debit and routing with gorgeous multi-stage loading sequences
  const handlePinSuccess = async () => {
    if (!pinPadConfig || !firebaseUser || !profile) return;
    
    setIsProcessing(true);
    setProcessingStep('VERIFYING');
    const configCopy = { ...pinPadConfig };
    setPinPadConfig(null);

    // After 1200ms, go to ROUTING stage
    setTimeout(() => {
      setProcessingStep('ROUTING');
    }, 1200);

    // After 2400ms, go to SUCCESS stage
    setTimeout(() => {
      setProcessingStep('SUCCESS');
    }, 2400);

    // After 3900ms, execute the transaction debit and dispatch receipt
    setTimeout(async () => {
      const { bankAccount, amount, remarks, payeeName, payeeUpi } = configCopy;
      const userRef = doc(db, 'users', firebaseUser.uid);

      try {
        // Debit funds solely from the exclusive AMIT PAYMENTS BANK account
        const updatedAccounts = profile.bankAccounts.map(b => {
          if (b.id === bankAccount.id) {
            return {
              ...b,
              balance: Math.max(0, b.balance - amount)
            };
          }
          return b;
        });

        const newProfileBalance = Math.max(0, (profile.balance !== undefined ? profile.balance : 50.00) - amount);

        await updateDoc(userRef, {
          bankAccounts: updatedAccounts,
          balance: newProfileBalance
        });

        // Register new immutable transaction record in Firestore
        const refNo = generateRefNo();
        const newTxData = {
          type: 'SEND' as const,
          name: payeeName,
          upiId: payeeUpi,
          amount,
          status: 'SUCCESS' as const,
          date: new Date().toISOString(),
          refNo,
          remarks: remarks || '',
          bankName: 'AMIT PAYMENTS BANK',
          userId: firebaseUser.uid
        };

        const docRef = await addDoc(collection(db, 'transactions'), newTxData);
        const newTx: Transaction = { id: docRef.id, ...newTxData };

        // Save recipient to contact links list
        const exists = payees.some(py => py.upiId.toLowerCase() === payeeUpi.toLowerCase());
        if (!exists) {
          const extraPayee: Payee = {
            id: `p-${Date.now()}`,
            name: payeeName,
            upiId: payeeUpi,
            phone: `+91 ${Math.floor(60000 + Math.random() * 39999)} ${Math.floor(10000 + Math.random() * 89999)}`,
            avatarColor: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
          };
          setPayees(prev => [...prev, extraPayee]);
        }

        setIsProcessing(false);
        setProcessingStep(null);
        setViewingReceiptTx(newTx);
      } catch (err) {
        console.error('Error settling payment:', err);
        setIsProcessing(false);
        setProcessingStep(null);
        alert('A transaction settlement error occurred. Please verify permissions.');
      }
    }, 3900);
  };

  const handlePinFailure = (attemptsLeft: number) => {
    if (attemptsLeft <= 0) {
      alert('Security Lock: Too many incorrect attempts! Transfer aborted.');
      setPinPadConfig(null);
    }
  };

  // Return ONLY AMIT PAYMENTS BANK as the single source
  const getSelectablePaymentSources = (): BankAccount[] => {
    if (!profile) return [];
    return profile.bankAccounts || [];
  };

  // Main loader checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-400">AMITCASH Secure Router Initializing...</p>
      </div>
    );
  }

  // Not authenticated? Show the Premium Sign Up & Login view
  if (!firebaseUser || !profile) {
    return (
      <Auth 
        onUserAuthenticated={(user) => {
          setFirebaseUser(user);
        }} 
      />
    );
  }

  // Enforce secure 4-digit PIN lockscreen (always use PIN first!)
  if (!isUnlocked) {
    return (
      <PinLock 
        userProfile={profile}
        onUnlocked={() => setIsUnlocked(true)}
        onSetPin={async (newPin) => {
          const userRef = doc(db, 'users', firebaseUser.uid);
          await updateDoc(userRef, {
            appPin: newPin
          });
        }}
      />
    );
  }

  // Enforce real-time email verification check AFTER the PIN lock screen resolves
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <EmailVerificationScreen 
        user={firebaseUser}
        onVerified={() => {
          const u = auth.currentUser;
          if (u) {
            setFirebaseUser({ ...u });
          }
        }}
        onSignOut={handleLogout}
      />
    );
  }

  const selectedPaymentSources = getSelectablePaymentSources();
  const currentActiveAccount = selectedPaymentSources.find(p => p.id === profile.activeBankId) || selectedPaymentSources[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Visual Top Navigation Hub */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-none">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          {/* Logo & NPCI authorization badge */}
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Smartphone className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5 justify-start">
                <span className="font-sans font-black tracking-tight text-slate-900 text-sm sm:text-base">AMITCASH</span>
                <span className="font-mono text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded border border-indigo-100">Verified Client</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">NPCI AMITCASH Payments Architecture Area</p>
            </div>
          </div>

          {/* User profile identifier & Logout mechanism */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 p-1.5 pl-3 rounded-full hidden sm:flex">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-800 block leading-tight">{profile.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block tracking-tight">{profile.upiId}</span>
              </div>
              
              {/* Cloudinary uploaded picture support */}
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name} 
                  className="w-8 h-8 rounded-full object-cover border border-slate-200" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-inner">
                  {profile.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Logout Trigger */}
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Logout Securely"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Sub Header Panel with Dynamic Quick Action Rail */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <h1 className="font-sans font-extrabold text-slate-900 text-lg leading-tight flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Interactive Payments Client
            </h1>
            <p className="text-xs text-slate-500">
              Send payments securely from your verified AMIT PAYMENTS BANK account, or scan and pay with visual canvas readers.
            </p>
          </div>

          {/* Centralized Primary Scan Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] text-white rounded-xl py-3 px-6 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md focus:outline-none shrink-0 cursor-pointer"
          >
            <QrCode className="w-4.5 h-4.5" />
            Scan
          </button>
        </div>

        {/* View Segment Tabs selection */}
        <div className="flex flex-wrap border-b border-slate-200">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`py-3 px-5 sm:px-6 font-sans font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Payments & Activity Dashboard
          </button>
          <button
            onClick={() => setActiveTab('CREATE_QR')}
            className={`py-3 px-5 sm:px-6 font-sans font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'CREATE_QR'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Request billing / Create QR
          </button>
          <button
            onClick={() => setActiveTab('GENERATE_CODES')}
            className={`py-3 px-5 sm:px-6 font-sans font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'GENERATE_CODES'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Generate Secure Codes
          </button>
        </div>

        {/* Dynamic Inner views */}
        <div className="transition-all duration-150">
          {activeTab === 'DASHBOARD' ? (
            <Dashboard
              userProfile={profile}
              transactions={transactions}
              payees={payees}
              onSelectPayee={initiatePayeePayment}
              onSelectBank={selectBank}
              onInitiateRawUpi={initiateRawAddressPayment}
              onViewReceipt={(tx) => setViewingReceiptTx(tx)}
              onSimulateReceive={handleSimulateReceive}
            />
          ) : activeTab === 'CREATE_QR' ? (
            <GenerateQR userProfile={profile} />
          ) : (
            <GenerateCodes userProfile={profile} />
          )}
        </div>

      </main>

      {/* AMITCASH trust line stamp */}
      <footer className="bg-slate-900 text-slate-500 text-center py-6 mt-12 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[10px] font-medium leading-relaxed">
            © 2026 NPCI UPI Systems Core • Secured under authenticated email session ({profile.email}). No real cards debited.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">AMITCASH SECURITY ENGINE ACTIVE</span>
          </div>
        </div>
      </footer>

      {/* Overlay: Interactive Scanning Interface */}
      {isScannerOpen && (
        <CameraScanner
          onScanSuccess={handleQrScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Overlay: Payment Formulation Input Drawer */}
      {activePaymentParams && (
        <InitiatePayment
          paymentParams={activePaymentParams}
          bankAccounts={selectedPaymentSources}
          activeBankId={profile.activeBankId}
          onSelectBank={selectBank}
          onProceedToPin={handleProceedToPin}
          onCancel={() => setActivePaymentParams(null)}
        />
      )}

      {/* Overlay: Secure PIN entry keypad */}
      {pinPadConfig && (
        <PinPad
          bankAccount={pinPadConfig.bankAccount}
          paymentAmount={pinPadConfig.amount}
          payeeName={pinPadConfig.payeeName}
          payeeUpi={pinPadConfig.payeeUpi}
          onPinSuccess={handlePinSuccess}
          onPinFailure={handlePinFailure}
          onCancel={() => setPinPadConfig(null)}
        />
      )}

      {/* Overlay: Live Banking router settlement processor */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-slate-800 text-center"
          >
            {processingStep === 'VERIFYING' && (
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-0 border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                  ></motion.div>
                  <Shield className="w-10 h-10 text-indigo-600 animate-pulse" />
                </div>
                <h3 className="font-sans font-black text-lg text-slate-900 tracking-tight">Verifying Security PIN</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Establishing secure tunnel with AMIT PAYMENTS BANK and validating entry certificate credentials...
                </p>
              </div>
            )}

            {processingStep === 'ROUTING' && (
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-sky-100 rounded-full"></div>
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="absolute inset-0 border-4 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                  ></motion.div>
                  <RefreshCw className="w-10 h-10 text-sky-500 animate-spin" />
                </div>
                <h3 className="font-sans font-black text-lg text-slate-900 tracking-tight">Securing Routing Channel</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Routing digital request tokens through secure AMITCASH gateway protocols. Please do not close this browser tab.
                </p>
              </div>
            )}

            {processingStep === 'SUCCESS' && (
              <div className="flex flex-col items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="rounded-full bg-emerald-100 p-4 border border-emerald-200 mb-6 flex items-center justify-center shadow-lg"
                >
                  <svg 
                    className="w-16 h-16 text-emerald-600" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={3.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h3 className="font-sans font-black text-xl text-slate-950 tracking-tight">Payment Successful</h3>
                <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full mt-2">
                  Settled Instantly
                </p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Transferred via 256-bit secure gateway token. Launching electronic receipt...
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Overlay: Shareable Completed Receipts card */}
      {viewingReceiptTx && (
        <Receipt
          transaction={viewingReceiptTx}
          bankAccount={selectedPaymentSources.find(v => v.bankName === viewingReceiptTx.bankName)}
          onClose={() => setViewingReceiptTx(null)}
        />
      )}

    </div>
  );
}
