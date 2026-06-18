export interface Transaction {
  id: string;
  type: 'SEND' | 'RECEIVE';
  name: string;
  upiId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  date: string;
  refNo: string;
  remarks?: string;
  bankName: string;
}

export interface Payee {
  id: string;
  name: string;
  upiId: string;
  phone: string;
  avatarColor: string;
  isMerchant?: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string; // Already masked, e.g., '•••• 4821'
  ifsc: string;
  balance: number;
  upiPin: string; // The UPI PIN used for payments
  bankType: 'SAVINGS' | 'CURRENT';
  logoColor: string;
}

export interface UserProfile {
  name: string;
  phone: string;
  upiId: string;
  email: string;
  balance: number;
  bankAccounts: BankAccount[];
  activeBankId: string;
  avatarUrl?: string;
  appPin?: string; // Secure 4-digit PIN for lockscreen and balance enquiry
}

export interface DecodedUpiContent {
  pa: string; // Payee Address (UPI ID)
  pn?: string; // Payee Name
  am?: string; // Amount
  tn?: string; // Transaction Note (remarks)
  cu?: string; // Currency (defaults to INR)
  tr?: string; // Transaction Ref ID
}
