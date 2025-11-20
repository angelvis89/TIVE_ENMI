import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TIVData } from "../types";

// Define the schema for structured JSON output from Gemini
const tivSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    titulo_numero: { type: Type.STRING, description: "Número de Título (Layout: Top Left)" },
    fecha: { type: Type.STRING, description: "Fecha de emisión" },
    zona_registral: { type: Type.STRING, description: "Zona Registral (ej. IX)" },
    sede_registral: { type: Type.STRING, description: "Sede Registral (ej. CHICLAYO)" },
    partida_registral: { type: Type.STRING, description: "Partida Registral (Layout: Top Right)" },
    dua_dam: { type: Type.STRING, description: "DUA / DAM" },
    placa: { type: Type.STRING, description: "Placa del vehículo (Layout: Large Text, Top Right)" },
    categoria: { type: Type.STRING, description: "Categoría (ej. L3)" },
    marca: { type: Type.STRING, description: "Marca" },
    modelo: { type: Type.STRING, description: "Modelo" },
    color: { type: Type.STRING, description: "Color principal" },
    numero_vin: { type: Type.STRING, description: "Número de VIN / Chasis" },
    numero_serie: { type: Type.STRING, description: "Número de Serie" },
    numero_motor: { type: Type.STRING, description: "Número de Motor" },
    carroceria: { type: Type.STRING, description: "Tipo de Carrocería" },
    potencia: { type: Type.STRING, description: "Potencia (ej. 9,70@8000)" },
    combustible: { type: Type.STRING, description: "Combustible" },
    form_rod: { type: Type.STRING, description: "Fórmula Rodante (ej. 2x1)" },
    version: { type: Type.STRING, description: "Versión del modelo" },
    anio_fabricacion: { type: Type.STRING, description: "Año de Fabricación" },
    anio_modelo: { type: Type.STRING, description: "Año Modelo" },
    asientos: { type: Type.STRING, description: "Número de Asientos" },
    pasajeros: { type: Type.STRING, description: "Número de Pasajeros" },
    ruedas: { type: Type.STRING, description: "Número de Ruedas" },
    ejes: { type: Type.STRING, description: "Número de Ejes" },
    cilindros: { type: Type.STRING, description: "Número de Cilindros" },
    cilindrada: { type: Type.STRING, description: "Cilindrada" },
    longitud: { type: Type.STRING, description: "Longitud" },
    altura: { type: Type.STRING, description: "Altura" },
    ancho: { type: Type.STRING, description: "Ancho" },
    peso_bruto: { type: Type.STRING, description: "Peso Bruto" },
    peso_neto: { type: Type.STRING, description: "Peso Neto" },
    carga_util: { type: Type.STRING, description: "Carga Útil" },
    codigo_verificacion: { type: Type.STRING, description: "Código de Verificación (Located near QR code or header)" },
  },
  required: ["placa", "numero_motor", "numero_serie", "marca", "modelo"],
};

export const extractDataFromImage = async (base64Image: string): Promise<TIVData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Using Flash 2.5 for high speed and spatial understanding
  const modelId = 'gemini-2.5-flash'; 

  const prompt = `
    You are an expert AI specializing in Peruvian Vehicle Registration Documents (Tarjeta de Identificación Vehicular Electrónica - TIV).
    
    TASK:
    Analyze the provided image of a TIV. Recognize the location of specific fields based on standard TIV layout and extract the text into the JSON schema provided.

    LAYOUT & LOCATION RULES:
    1. **PLACA**: Located prominently in the top-right quadrant. Format is typically "ABC-123" or "1234-AB". 
       - Critical: Distinguish between '0' (zero) and 'O' (letter). 
       - If text is 'M0T0R', it is likely 'MOTOR' (header), do not confuse headers with values.
    2. **QR & Security**: The "Código de Verificación" is usually a numeric or alphanumeric string near the QR code or top header.
    3. **Datos del Vehículo**: This section is in the middle-left. Contains: Marca, Modelo, Color, Motor, VIN, Serie.
    4. **Technical Specs**: Bottom/Right section. Contains: Pesos, Dimensiones, Asientos.

    VALIDATION RULES:
    - If a field is "SIN VERSION", "---", or empty, return an empty string.
    - **Potencia**: Must capture the full format including RPM if present (e.g., "9.70@8000").
    - **Combustible**: Normalize to standard terms (GASOLINA, DIESEL, GLP, BI-COMBUSTIBLE).
    - **Placa**: Ensure the format matches standard Peruvian plates.

    Extract all data accurately.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: tivSchema,
      },
    });

    const text = response.text;
    if (!text) {
        throw new Error("No response text from Gemini");
    }

    const parsedData = JSON.parse(text) as TIVData;
    return parsedData;

  } catch (error) {
    console.error("Gemini extraction error:", error);
    throw error;
  }
};