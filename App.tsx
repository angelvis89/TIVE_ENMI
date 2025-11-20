import React, { useState, useRef } from 'react';
import { convertPdfToImage, embedQrInPdf } from './services/pdfService';
import { extractDataFromImage } from './services/geminiService';
import { scanQRFromBase64, generateQRImageBase64 } from './services/qrService';
import { generateFilledDocument } from './services/documentService';
import { TIVData, EMPTY_TIV_DATA } from './types';
import { Spinner } from './components/Spinner';
import { DataField } from './components/DataField';
import { Upload, FileText, CheckCircle, AlertCircle, Scan, Cpu, QrCode, FileType, Search, FileDown } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<TIVData>(EMPTY_TIV_DATA);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  
  // Document Generation State
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  
  // 3-Step Workflow State
  const [processingStep1, setProcessingStep1] = useState(false);
  const [processingStep2, setProcessingStep2] = useState(false);
  const [processingStep3, setProcessingStep3] = useState(false);

  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [pdfNoQrBlob, setPdfNoQrBlob] = useState<Blob | null>(null);

  // Module statuses
  const [qrStatus, setQrStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [aiStatus, setAiStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  
  // Hidden container for PDF generation
  const docxContainerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Por favor selecciona un archivo PDF válido.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.docx')) {
        alert('Por favor selecciona un archivo Word (.docx) válido.');
        return;
      }
      setTemplateFile(selectedFile);
      setStep1Done(false);
      setStep2Done(false);
      setDocxBlob(null);
      setPdfNoQrBlob(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile.type !== 'application/pdf') {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }
        setFile(selectedFile);
        setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setQrStatus('pending');
    setAiStatus('pending');
    setStatusMessage("Inicializando módulos de escaneo...");

    try {
      setStatusMessage("Renderizando PDF para análisis visual...");
      const base64Img = await convertPdfToImage(file);

      setStatusMessage("Ejecutando reconocimiento de IA y decodificación QR...");
      
      const aiPromise = extractDataFromImage(base64Img)
        .then(res => {
            setAiStatus('success');
            return res;
        })
        .catch(err => {
            setAiStatus('failed');
            throw err;
        });

      const qrPromise = scanQRFromBase64(base64Img)
        .then(res => {
            setQrStatus(res ? 'success' : 'failed');
            return res;
        });

      const [extractedData, qrResult] = await Promise.all([aiPromise, qrPromise]);
      
      const finalData: TIVData = {
        ...extractedData,
        qr_data: qrResult 
      };

      setData(finalData);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al procesar el documento.");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  // PASO 1: Generar DOCX y Descargar
  const handleStep1 = async () => {
    if (!templateFile) {
        alert("Por favor carga primero la plantilla .docx");
        return;
    }
    
    setProcessingStep1(true);
    try {
        const blob = await generateFilledDocument(templateFile, data);
        setDocxBlob(blob);
        
        const saveAs = (window as any).saveAs;
        if(saveAs) saveAs(blob, `1_ENMICADO_WORD_${data.placa || 'TEMP'}.docx`);
        
        setStep1Done(true);
        // Reset step 2/3 if regenerating step 1
        setStep2Done(false);
        setPdfNoQrBlob(null);
    } catch (e) {
        console.error(e);
        alert("Error generando el documento DOCX.");
    } finally {
        setProcessingStep1(false);
    }
  };

  // PASO 2 MEJORADO: Renderizar DOCX -> PDF (Usa automáticamente el DOCX del Paso 1)
  const handleStep2 = async () => {
      // Usar automáticamente el DOCX generado en Paso 1
      if (!docxBlob) {
          alert("No hay archivo DOCX disponible. Por favor completa primero el Paso 1.");
          return;
      }

      if (!docxContainerRef.current) return;

      setProcessingStep2(true);
      setStatusMessage("Renderizando documento...");

      try {
          const docx = (window as any).docx;
          const html2canvas = (window as any).html2canvas;
          const { jsPDF } = (window as any).jspdf;

          if (!docx) throw new Error("Error: Librería docx-preview no encontrada. Verifique las dependencias.");
          if (!html2canvas || !jsPDF) throw new Error("Error: Librerías de PDF no encontradas.");

          // 1. Limpiar contenedor
          docxContainerRef.current.innerHTML = "";
          
          // 2. Convertir Blob a ArrayBuffer
          const arrayBuffer = await docxBlob.arrayBuffer();
          
          setStatusMessage("Procesando contenido del documento...");
          
          // 3. Renderizar con configuración OPTIMIZADA
          await docx.renderAsync(arrayBuffer, docxContainerRef.current, null, {
             className: "docx-viewer",
             inWrapper: true,
             ignoreWidth: false,
             ignoreHeight: false,
             ignoreFonts: false,
             breakPages: true,
             useBase64URL: true,
             experimental: true, // Características experimentales
             trimXmlDeclaration: true,
          });

          setStatusMessage("Esperando carga de recursos (fuentes e imágenes)...");
          
          // 4. TIMEOUT AUMENTADO para asegurar carga completa
          await new Promise(resolve => setTimeout(resolve, 3500));

          // 5. Preparar elemento objetivo
          const targetElement = docxContainerRef.current.querySelector('.docx-wrapper') as HTMLElement || docxContainerRef.current;
          
          // Forzar estilos de impresión
          targetElement.style.background = "white";
          targetElement.style.padding = "0";
          targetElement.style.margin = "0";

          setStatusMessage("Capturando documento de alta resolución...");

          // 6. Capturar con ALTA CALIDAD
          const canvas = await html2canvas(targetElement, {
              scale: 3, // Escala aumentada para mejor calidad
              useCORS: true,
              allowTaint: false,
              backgroundColor: '#ffffff',
              logging: false,
              imageTimeout: 15000,
              removeContainer: false,
              windowWidth: 800,
              windowHeight: 1131,
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98); // Máxima calidad
          
          setStatusMessage("Generando PDF final...");

          // 7. Crear PDF con dimensiones exactas A4
          const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4',
              compress: true
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const canvasRatio = canvas.width / canvas.height;
          
          let imgWidth = pageWidth;
          let imgHeight = pageWidth / canvasRatio;
          
          // 8. SOPORTE MULTI-PÁGINA AUTOMÁTICO
          if (imgHeight > pageHeight) {
              const pagesNeeded = Math.ceil(imgHeight / pageHeight);
              
              for (let i = 0; i < pagesNeeded; i++) {
                  if (i > 0) pdf.addPage();
                  
                  const sourceY = i * (canvas.height / pagesNeeded);
                  const sourceHeight = canvas.height / pagesNeeded;
                  
                  // Canvas temporal para cada página
                  const tempCanvas = document.createElement('canvas');
                  tempCanvas.width = canvas.width;
                  tempCanvas.height = sourceHeight;
                  const tempCtx = tempCanvas.getContext('2d');
                  
                  if (tempCtx) {
                      tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
                      const pageImgData = tempCanvas.toDataURL('image/jpeg', 0.98);
                      pdf.addImage(pageImgData, 'JPEG', 0, 0, pageWidth, pageHeight);
                  }
              }
          } else {
              // Una sola página
              pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
          }
          
          const pdfBlob = pdf.output('blob');
          setPdfNoQrBlob(pdfBlob);

          const saveAs = (window as any).saveAs;
          if (saveAs) saveAs(pdfBlob, `2_ENMICADO_PDF_${data.placa || 'TIV'}.pdf`);

          setStep2Done(true);
          setStatusMessage("✓ PDF generado exitosamente");
          
          // Limpiar mensaje después de 2 segundos
          setTimeout(() => setStatusMessage(""), 2000);

      } catch (e: any) {
          console.error(e);
          alert("Error al generar PDF desde DOCX: " + e.message);
          setStatusMessage("");
      } finally {
          setProcessingStep2(false);
      }
  };

  // PASO 3: Inyectar QR -> Descargar PDF Final
  const handleStep3 = async () => {
      if (!pdfNoQrBlob) return;
      
      setProcessingStep3(true);
      setStatusMessage("Procesando código QR...");
      
      try {
          let finalPdfBytes;
          
          if (!data.qr_data) {
              finalPdfBytes = await pdfNoQrBlob.arrayBuffer();
              alert("Nota: No se detectó datos QR en el origen. PDF descargado sin QR.");
          } else {
              setStatusMessage("Generando código QR...");
              const qrBase64 = await generateQRImageBase64(data.qr_data);
              
              setStatusMessage("Inyectando QR al PDF...");
              finalPdfBytes = await embedQrInPdf(pdfNoQrBlob, qrBase64);
          }

          const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
          const saveAs = (window as any).saveAs;
          if(saveAs) saveAs(finalBlob, `3_ENMICADO_FINAL_QR_${data.placa || 'TIV'}.pdf`);

          setStatusMessage("✓ Proceso completado");
          setTimeout(() => setStatusMessage(""), 2000);

      } catch (e: any) {
          console.error(e);
          alert("Error al inyectar el código QR: " + e.message);
          setStatusMessage("");
      } finally {
          setProcessingStep3(false);
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFile(null);
    setData(EMPTY_TIV_DATA);
    setStep(1);
    setQrStatus('pending');
    setAiStatus('pending');
    setStep1Done(false);
    setStep2Done(false);
    setDocxBlob(null);
    setPdfNoQrBlob(null);
    setStatusMessage("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      
      {/* HIDDEN DOCX RENDERER CONTAINER */}
      <div 
        id="docx-hidden-container"
        style={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            width: '800px',
            zIndex: -100,
            opacity: 0,
            overflow: 'hidden',
            backgroundColor: 'white'
        }}
      >
         <div ref={docxContainerRef}></div>
      </div>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-md">
              <Scan className="text-white h-5 w-5" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">TIV AI Scanner</h1>
                <p className="text-[0.65rem] text-indigo-600 font-bold uppercase tracking-wider">Automatización Documental Vehicular</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-medium text-gray-500">
             <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Gemini 2.5 AI</span>
             <span className="flex items-center gap-1"><QrCode className="h-3 w-3" /> Verificación QR</span>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8">
        <div className="max-w-[1600px] mx-auto">
          
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm animate-fade-in">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded shadow-sm">
              <div className="flex items-center gap-2">
                <Spinner />
                <p className="text-sm text-blue-700 font-medium">{statusMessage}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-2xl mx-auto mt-10">
                <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100 transition-all hover:shadow-2xl">
                    <div className="p-10 text-center">
                        <div className="mx-auto h-24 w-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative group">
                            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
                            <Upload className="h-10 w-10 text-indigo-600 relative z-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">Cargar Tarjeta de Propiedad (PDF)</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto text-sm">
                            Nuestro sistema híbrido (IA + Visión) detectará automáticamente placa, ubicación de datos y código QR.
                        </p>

                        <div 
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-12 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer mb-8 group"
                        >
                            <input 
                                type="file" 
                                accept=".pdf" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            {file ? (
                                <div className="flex flex-col items-center justify-center gap-2 text-indigo-600 font-medium animate-fade-in">
                                    <FileText className="h-8 w-8 mb-2" />
                                    <span className="text-lg">{file.name}</span>
                                    <span className="text-xs text-indigo-400">{(file.size / 1024).toFixed(0)} KB</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-400 font-medium group-hover:text-indigo-500 transition-colors">Arrastra tu PDF aquí o haz clic para buscar</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={!file || loading}
                            className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-3
                                ${!file || loading 
                                    ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Spinner />
                                    <span className="animate-pulse">Analizando...</span>
                                </>
                            ) : (
                                <>
                                    <Search className="h-5 w-5" />
                                    Analizar y Extraer Datos
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* Form Column */}
              <div className="xl:col-span-6 space-y-6">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Datos Extraídos
                    </h3>
                    <div className="flex gap-2">
                        <span className={`text-[10px] uppercase tracking-wide py-1 px-2 rounded-md font-bold border ${aiStatus === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700'}`}>
                            IA: {aiStatus === 'success' ? 'OK' : 'Err'}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wide py-1 px-2 rounded-md font-bold border ${qrStatus === 'success' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                            QR: {qrStatus === 'success' ? 'OK' : 'N/A'}
                        </span>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                    <div className="col-span-1 sm:col-span-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                        <h4 className="text-xs font-black text-blue-800 mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <Scan className="h-4 w-4" /> Identificación
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <DataField label="Placa" name="placa" value={data.placa} onChange={handleInputChange} className="font-bold" />
                            <DataField label="Cod. Verificación" name="codigo_verificacion" value={data.codigo_verificacion} onChange={handleInputChange} />
                            {data.qr_data && (
                                <div className="col-span-2 mt-2 bg-white p-3 rounded border border-green-200 flex items-start gap-3">
                                    <QrCode className="h-5 w-5 text-green-600 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-green-700">QR Verificable Detectado:</p>
                                        <p className="text-xs text-gray-600 break-all font-mono mt-1">{data.qr_data.substring(0, 60)}...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                         <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b pb-2">Datos Principales</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <DataField label="Marca" name="marca" value={data.marca} onChange={handleInputChange} />
                            <DataField label="Modelo" name="modelo" value={data.modelo} onChange={handleInputChange} />
                            <DataField label="VIN" name="numero_vin" value={data.numero_vin} onChange={handleInputChange} />
                            <DataField label="Motor" name="numero_motor" value={data.numero_motor} onChange={handleInputChange} />
                            <DataField label="Serie" name="numero_serie" value={data.numero_serie} onChange={handleInputChange} />
                            <DataField label="Color" name="color" value={data.color} onChange={handleInputChange} />
                         </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Column */}
              <div className="xl:col-span-6 space-y-6">
                <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200 h-full">
                     <div className="p-6 bg-indigo-900 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FileType className="h-6 w-6 text-indigo-300" />
                            Flujo de Trabajo
                        </h3>
                        <button onClick={handleReset} className="text-xs text-indigo-300 hover:text-white underline">Reiniciar</button>
                     </div>
                     
                     <div className="p-6 space-y-8">
                        
                        {/* Template Upload */}
                        <div>
                            <h4 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider">Configuración Inicial</h4>
                            
                            <div 
                                onClick={() => templateInputRef.current?.click()}
                                className="border border-dashed border-indigo-300 rounded-lg p-3 text-center cursor-pointer hover:bg-indigo-50 transition-all bg-white"
                            >
                                <input type="file" accept=".docx" className="hidden" ref={templateInputRef} onChange={handleTemplateChange} />
                                {templateFile ? (
                                    <div className="text-sm font-bold text-green-600 truncate flex items-center justify-center gap-2">
                                        <CheckCircle className="h-4 w-4" /> {templateFile.name}
                                    </div>
                                ) : (
                                    <div className="text-sm text-indigo-600 font-medium flex items-center justify-center gap-2">
                                        <Upload className="h-4 w-4" /> Cargar Plantilla Word (.docx)
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3-STEP WORKFLOW */}
                        {templateFile && (
                            <div className="space-y-4">
                                <div className="relative pl-4 border-l-2 border-indigo-100 space-y-8">
                                    
                                    {/* STEP 1: DOCX */}
                                    <div className="relative">
                                        <span className={`absolute -left-[21px] top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step1Done ? 'bg-green-100 text-green-700 border-green-500' : 'bg-white text-indigo-600 border-indigo-600'}`}>
                                            1
                                        </span>
                                        <div className="mb-2">
                                            <h4 className="font-bold text-gray-800">Generar Word Rellenado</h4>
                                            <p className="text-xs text-gray-500">Crea y descarga el archivo .docx con los datos.</p>
                                        </div>
                                        <button
                                            onClick={handleStep1}
                                            disabled={processingStep1}
                                            className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 hover:border-indigo-300 flex items-center justify-between transition-all"
                                        >
                                            {processingStep1 ? <Spinner /> : <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Generar y Descargar DOCX</span>}
                                            {step1Done && <CheckCircle className="h-5 w-5 text-green-500" />}
                                        </button>
                                    </div>

                                    {/* STEP 2: PDF CONVERSION AUTOMATICO */}
                                    <div className={`relative ${!step1Done ? 'opacity-50' : ''}`}>
                                        <span className={`absolute -left-[21px] top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step2Done ? 'bg-green-100 text-green-700 border-green-500' : 'bg-white text-gray-400 border-gray-300'}`}>
                                            2
                                        </span>
                                        <div className="mb-2">
                                            <h4 className="font-bold text-gray-800">Convertir DOCX a PDF</h4>
                                            <p className="text-xs text-gray-500">Usa automáticamente el archivo generado en Paso 1.</p>
                                            
                                            {step1Done && docxBlob && (
                                                <div className="mt-2 flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded p-2">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <span className="text-green-700 font-medium">Archivo DOCX listo para conversión</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleStep2}
                                            disabled={!step1Done || processingStep2}
                                            className={`w-full py-3 px-4 border font-bold rounded-lg flex items-center justify-between transition-all
                                                ${step1Done
                                                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-indigo-300' 
                                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}
                                        >
                                            {processingStep2 ? <Spinner /> : <span className="flex items-center gap-2"><FileDown className="h-4 w-4" /> Convertir a PDF</span>}
                                            {step2Done && <CheckCircle className="h-5 w-5 text-green-500" />}
                                        </button>
                                    </div>

                                    {/* STEP 3: QR INJECTION */}
                                    <div className={`relative ${!step2Done ? 'opacity-50' : ''}`}>
                                        <span className={`absolute -left-[21px] top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step2Done ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-300'}`}>
                                            3
                                        </span>
                                        <div className="mb-2">
                                            <h4 className="font-bold text-gray-800">Inyectar QR y Finalizar</h4>
                                            <p className="text-xs text-gray-500">Estampa el QR verificable en el PDF final.</p>
                                        </div>
                                        <button
                                            onClick={handleStep3}
                                            disabled={!step2Done || processingStep3}
                                            className={`w-full py-4 px-4 font-bold rounded-lg shadow-md flex items-center justify-center gap-2 transition-all
                                                ${step2Done 
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg' 
                                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                        >
                                            {processingStep3 ? (
                                                <Spinner />
                                            ) : (
                                                <>
                                                    <QrCode className="h-5 w-5" />
                                                    DESCARGAR FINAL
                                                </>
                                            )}
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}

                     </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;