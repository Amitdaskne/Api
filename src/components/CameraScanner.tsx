import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, RefreshCw, Upload, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { parseUpiUrl } from '../utils/upi';
import { DecodedUpiContent } from '../types';

interface CameraScannerProps {
  onScanSuccess: (data: DecodedUpiContent) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScanSuccess, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Ready-to-go test cases for simulation/testing
  const MOCK_PQR_CODES = [
    {
      label: 'Merchant: Food Plaza (₹120)',
      upi: 'upi://pay?pa=foodplaza@okaxis&pn=Food%20Plaza&am=120.00&tn=Dinner%20Bill',
      desc: 'Simulate scan for standard restaurant dinner bill',
    },
    {
      label: 'Friend: Aarav Sharma (₹500)',
      upi: 'upi://pay?pa=aarav.sharma@paytm&pn=Aarav%20Sharma&am=500.00&tn=Room%20Rent%20Share',
      desc: 'Simulate scan of peer transfer without fixed amount',
    },
    {
      label: 'Dynamic Merchant: Supermart',
      upi: 'upi://pay?pa=supermart@hdfc&pn=Supermart%20Retail&tn=Grocery%20Store',
      desc: 'Scan grocery checkout (requires inputting custom amount)',
    },
    {
      label: 'Static Personal UPI ID',
      upi: 'priya.patel@amitcash',
      desc: 'Raw UPI ID scanning fallback format',
    },
  ];

  // Load available camera devices
  useEffect(() => {
    async function initDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop()); // Stop early to release

        const devInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devInfos.filter(sub => sub.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0) {
          setSelectedDevice(videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Camera access error or unsupported:', err);
        setHasCameraPermission(false);
        setErrorMsg('Microphone/Camera access was denied or is blocked in this container frame context.');
      }
    }
    initDevices();
  }, []);

  // Handle active video stream binding
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationId: number;

    async function startCamera() {
      if (!selectedDevice && hasCameraPermission) return;
      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDevice 
            ? { deviceId: { exact: selectedDevice } } 
            : { facingMode: 'environment' }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          setIsScanning(true);
          
          // Trigger scan loop
          animationId = requestAnimationFrame(scanLoop);
        }
      } catch (err) {
        console.error('Error starting video stream:', err);
        setErrorMsg('Unable to bind physical camera stream. Using simulators is recommended.');
      }
    }

    if (hasCameraPermission) {
      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationId);
      setIsScanning(false);
    };
  }, [selectedDevice, hasCameraPermission]);

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
      animationIdRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    // Check if video is loaded and has dimensions
    if (videoRef.current.videoWidth > 0) {
      canvas.width = Math.min(videoRef.current.videoWidth, 640);
      canvas.height = Math.min(videoRef.current.videoHeight, 480);
      
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        const parsed = parseUpiUrl(code.data);
        if (parsed) {
          onScanSuccess(parsed);
          return; // Stop scanning sequence
        }
      }
    }
    animationIdRef.current = requestAnimationFrame(scanLoop);
  };

  const animationIdRef = useRef<number>(0);

  // Fallback upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0);
          const iData = tempCtx.getImageData(0, 0, img.width, img.height);
          const scanned = jsQR(iData.data, img.width, img.height);
          if (scanned && scanned.data) {
            const parsed = parseUpiUrl(scanned.data);
            if (parsed) {
              onScanSuccess(parsed);
              return;
            }
          }
          alert('Could not decode a valid UPI payment QR code from this image. Please ensure the QR is clear and formatted correctly.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice);
    const nextIdx = (currentIndex + 1) % devices.length;
    setSelectedDevice(devices[nextIdx].deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h3 className="font-sans font-semibold text-lg text-white">Scan UPI QR Code</h3>
            <p className="text-xs text-slate-400">Secure contactless peer & merchant payments</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder Content Container */}
        <div className="relative flex-1 bg-slate-950 min-h-[280px] flex flex-col items-center justify-center overflow-hidden">
          
          {hasCameraPermission ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover max-h-[300px]"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Animated laser frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56 border-2 border-emerald-500 rounded-2xl flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Visual target brackets */}
                  <div className="flex justify-between">
                    <span className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 -mt-2 -ml-2 rounded-tl-md"></span>
                    <span className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 -mt-2 -mr-2 rounded-tr-md"></span>
                  </div>
                  
                  {/* Moving line */}
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] animate-bounce" />
                  
                  <div className="flex justify-between">
                    <span className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 -mb-2 -ml-2 rounded-bl-md"></span>
                    <span className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 -mb-2 -mr-2 rounded-br-md"></span>
                  </div>
                </div>
              </div>
              
              {/* Floating control bar */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                {devices.length > 1 && (
                  <button 
                    onClick={switchCamera}
                    className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full text-xs font-medium text-slate-300 flex items-center gap-1 border border-slate-700 hover:bg-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Switch Camera
                  </button>
                )}
                <span className="px-3 py-1.5 bg-emerald-950/80 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-400 flex items-center gap-1.5 border border-emerald-700/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Live Camera Scanner
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center max-w-sm flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="font-sans font-medium text-slate-200">Device stream not fully available</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                Physical camera scanning might be blocked in sandbox browsers. You can seamlessly pay by uploading a QR code image or selecting preconfigured mock UPI QR presets below!
              </p>
            </div>
          )}
        </div>

        {/* Upload Action / Presets Selector */}
        <div className="p-5 border-t border-slate-800 bg-slate-900 divide-y divide-slate-800 text-slate-300 max-h-[350px] overflow-y-auto">
          {/* File Upload Zone */}
          <div className="pb-4">
            <label className="group flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 cursor-pointer transition-colors bg-slate-950 hover:bg-emerald-950/20">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors mb-2" />
              <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">Upload QR file from disk</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Supports PNG, JPG containing standard UPI codes</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
            </label>
          </div>

          {/* Preset Simulate scans for quick grading */}
          <div className="pt-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Simulate Active Scan (Test presets)
            </h4>
            <div className="space-y-2">
              {MOCK_PQR_CODES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const parsed = parseUpiUrl(item.upi);
                    if (parsed) onScanSuccess(parsed);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all flex justify-between items-center group"
                >
                  <div className="pr-2">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded">
                    Tap to Scan
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info badge */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center flex items-center justify-center gap-1.5">
          <span className="font-mono text-[9px] text-slate-500 tracking-tight">NPCI SECURE ENCRYPTION CLIENT</span>
        </div>

      </div>
    </div>
  );
}
