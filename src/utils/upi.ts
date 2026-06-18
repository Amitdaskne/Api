import QRCode from 'qrcode';
import { DecodedUpiContent } from '../types';

/**
 * Parses a UPI URI scheme: upi://pay?pa=address&pn=name&am=amount&tn=note&cu=currency
 * If the string is just a UPI ID (e.g., recipient@bank), it wraps it as a basic UPI payout.
 */
export function parseUpiUrl(url: string): DecodedUpiContent | null {
  if (!url) return null;
  
  const trimmed = url.trim();
  if (trimmed.startsWith('upi://pay')) {
    try {
      const queryIdx = trimmed.indexOf('?');
      if (queryIdx === -1) return null;
      
      const searchString = trimmed.substring(queryIdx);
      const urlParams = new URLSearchParams(searchString);
      const pa = urlParams.get('pa');
      
      if (!pa) return null; // Pa is mandatory in UPI standard
      
      return {
        pa,
        pn: urlParams.get('pn') || undefined,
        am: urlParams.get('am') || undefined,
        tn: urlParams.get('tn') || undefined,
        cu: urlParams.get('cu') || 'INR',
        tr: urlParams.get('tr') || undefined,
      };
    } catch (e) {
      console.error('Error parsing UPI URL:', e);
      return null;
    }
  } else {
    // Fallback: Check if it's a raw contact UPI-ID (e.g. name@okaxis, receiver@paytm)
    const upiReg = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (upiReg.test(trimmed)) {
      return {
        pa: trimmed,
        pn: trimmed.split('@')[0], // placeholder name
      };
    }
    return null;
  }
}

/**
 * Builds a valid UPI payments URL string
 */
export function buildUpiUrl(params: DecodedUpiContent): string {
  const urlParams = new URLSearchParams();
  urlParams.set('pa', params.pa.trim());
  if (params.pn) urlParams.set('pn', params.pn.trim());
  if (params.am && Number(params.am) > 0) {
    urlParams.set('am', parseFloat(params.am).toFixed(2));
  }
  if (params.tn) urlParams.set('tn', params.tn.trim());
  urlParams.set('cu', params.cu || 'INR');
  if (params.tr) urlParams.set('tr', params.tr.trim());
  
  return `upi://pay?${urlParams.toString()}`;
}

/**
 * Generates a high-quality data URL representing the QR code
 */
export async function generateUpiQrCode(params: DecodedUpiContent, darkColor = '#0f172a'): Promise<string> {
  const upiUrl = buildUpiUrl(params);
  try {
    return await QRCode.toDataURL(upiUrl, {
      margin: 2,
      width: 400,
      color: {
        dark: darkColor,
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

/**
 * Generates a formatted NPCI-styled merchant ticket code helper
 */
export function generateRefNo(): string {
  // Mock standard 12-digit transaction index reference
  const dateStr = new Date().toISOString().substring(2, 10).replace(/-/g, '');
  const rands = Math.floor(1000 + Math.random() * 9000);
  return `${dateStr}${rands}`;
}
