import React, { useState, useEffect } from 'react';
import { TIVData } from '../types';
import { prepareTemplateData } from '../services/documentService';
import { ImageOff } from 'lucide-react';

interface TIVCardPreviewProps {
  data: TIVData;
  customTemplateUrl?: string | null;
  onReady?: () => void; // Callback when image is loaded
}

export const TIVCardPreview: React.FC<TIVCardPreviewProps> = ({ data, customTemplateUrl, onReady }) => {
  // Google Drive Direct Link for the background template
  const DRIVE_ID = "15kIxBDX3C-9sKnptKbNUZtNfEraK6j4T";
  const DRIVE_LINK = `https://drive.google.com/uc?export=view&id=${DRIVE_ID}`;
  
  const [finalBackgroundSrc, setFinalBackgroundSrc] = useState<string>("");
  const [imageError, setImageError] = useState(false);
  
  // Process data to match DOCX logic (Title Inversion, etc.)
  const formattedData = prepareTemplateData(data);

  // 1. Handle Background Image loading and CORS conversion
  useEffect(() => {
    let isMounted = true;

    const loadBackground = async () => {
        setImageError(false);
        
        // Case A: Custom local template (Blob URL) - already safe
        if (customTemplateUrl) {
            setFinalBackgroundSrc(customTemplateUrl);
            // Small delay to ensure render
            setTimeout(() => { if(onReady && isMounted) onReady(); }, 500);
            return;
        }

        // Case B: Remote Google Drive Image with CORS Proxy
        // We use a proxy to ensure we get the raw data for html2canvas
        try {
            // Using allorigins proxy to bypass CORS on the Drive link
            // This creates a Blob we can render cleanly without cross-origin taint
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(DRIVE_LINK)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) throw new Error("Failed to fetch image via proxy");
            
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result && isMounted) {
                    setFinalBackgroundSrc(reader.result as string);
                    setTimeout(() => { if(onReady && isMounted) onReady(); }, 500);
                }
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            console.error("CORS/Proxy Fetch failed, using fallback layout", e);
            if (isMounted) {
                setImageError(true);
                if(onReady) onReady(); // Ready even if error, to render fallback
            }
        }
    };
    
    loadBackground();

    return () => { isMounted = false; };
  }, [customTemplateUrl]);

  // Helper for field rendering
  const Field = ({ 
    val, top, left, right, bottom, width, align = 'left', size = 'text-[10px]', className = ''
  }: any) => {
    if (!val) return null;
    return (
      <div 
        className={`absolute font-bold text-slate-900 leading-none uppercase ${size} ${className} z-20`}
        style={{ top, left, right, bottom, width, textAlign: align }}
      >
        {val}
      </div>
    );
  };

  return (
    <div className="w-full flex justify-center overflow-hidden bg-white">
      {/* Fixed width 794px (approx A4 width at 96DPI) to ensure high res capture */}
      <div 
        id="tiv-card-visual"
        className="relative bg-white w-[794px] aspect-[210/297] font-sans overflow-hidden select-none"
      >
        
        {/* BACKGROUND IMAGE LAYER */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-white">
            {!imageError && finalBackgroundSrc ? (
                <img 
                    src={finalBackgroundSrc}
                    alt="Plantilla" 
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                    // Important: no crossOrigin needed here because we fetched via proxy into a blob!
                />
            ) : (
                // FALLBACK CSS LAYOUT IF IMAGE FAILS
                <div className="w-full h-full relative p-8 border-4 border-double border-gray-800">
                    <div className="absolute top-10 right-10 border-2 border-gray-900 w-64 h-20 rounded bg-gray-100 flex items-center justify-center text-gray-900 text-xl font-bold">PLACA: {formattedData.Placa}</div>
                    <div className="absolute top-10 left-10 space-y-4 w-1/3">
                         <div className="h-4 bg-gray-300 rounded w-full"></div>
                         <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    </div>
                    <div className="absolute bottom-10 left-0 w-full h-1/2 border-t-2 border-dashed border-gray-900 flex items-center justify-center">
                        <span className="text-gray-400 font-bold text-4xl rotate-180">FALLO CARGA IMAGEN</span>
                    </div>
                </div>
            )}
        </div>

        {/* SECTION 1: TOP HALF */}
        <div className="absolute top-0 left-0 w-full h-[50%] z-10">
            <div className="absolute top-[11.5%] left-[30%] space-y-[3px] z-20">
                <Field val={formattedData.Contador} top="0px" left="118px" size="text-[11px]" />
                <Field val={formattedData.Titulo_Invertido} top="15px" left="50px" size="text-[11px]" />
                <Field val={formattedData.Fecha} top="30px" left="40px" size="text-[11px]" />
            </div>

            <Field val={formattedData.Zona_Registral_Completa.replace("ZONA REGISTRAL N° ", "")} top="27.5%" left="28%" />
            <Field val={formattedData.Sede_Registral} top="29.5%" left="28%" />
            <Field val={formattedData.Partida_Nro} top="34%" left="28%" size="text-[12px]" />
            <Field val={formattedData.DUA} top="36.5%" left="22%" />
            <Field val={formattedData.Titulo_Invertido} top="39%" left="18%" />
            <Field val={formattedData.Fecha} top="41.5%" left="24%" />
            <Field val={formattedData.Placa} top="36%" right="15%" size="text-6xl font-black tracking-wider" align="right" />
        </div>

        {/* SECTION 2: BOTTOM HALF (ROTATED) */}
        <div className="absolute bottom-0 left-0 w-full h-[50%] z-10 rotate-180">
            <Field val={formattedData.Categoria} bottom="19.5%" left="25%" />
            <Field val={formattedData.Año_Modelo} bottom="19.5%" right="17%" />
            <Field val={formattedData.Marca} bottom="22%" left="21%" />
            <Field val={formattedData.Modelo} bottom="24.5%" left="22%" />
            <Field val={formattedData.Color} bottom="27%" left="21%" />
            <Field val={formattedData.Nro_VIN} bottom="29.5%" left="30%" />
            <Field val={formattedData.Nro_Serie} bottom="32%" left="31%" />
            <Field val={formattedData.Nro_Motor} bottom="34.5%" left="31%" />
            <Field val={formattedData.Tipo_Carroceria} bottom="37%" left="25%" />
            <Field val={formattedData.Potencia_Motor} bottom="39.5%" left="24%" />
            <Field val={formattedData.Formula_Rodante} bottom="42%" left="25%" />
            <Field val={formattedData.Nro_Version} bottom="42%" left="67%" />
            <Field val={formattedData.Tipo_Combustible} bottom="44.5%" left="27%" />

            <Field val={formattedData.Nro_Asientos} bottom="48.5%" left="25%" />
            <Field val={formattedData.Nro_Cilindros} bottom="48.5%" left="48%" />
            <Field val={formattedData.Cilindrada} bottom="48.5%" left="78%" />

            <Field val={formattedData.Nro_Pasajeros} bottom="51%" left="25%" />
            <Field val={formattedData.Longitud} bottom="51%" left="48%" />
            <Field val={formattedData.Peso_Bruto} bottom="51%" left="76%" />

            <Field val={formattedData.Nro_Ruedas} bottom="53.5%" left="24%" />
            <Field val={formattedData.Altura} bottom="53.5%" left="45%" />
            <Field val={formattedData.Peso_Neto} bottom="53.5%" left="75%" />

            <Field val={formattedData.Nro_Ejes} bottom="56%" left="22%" />
            <Field val={formattedData.Ancho} bottom="56%" left="45%" />
            <Field val={formattedData.Carga_Util} bottom="56%" left="77%" />
        </div>

      </div>
    </div>
  );
};