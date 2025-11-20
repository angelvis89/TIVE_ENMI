import { TIVData } from '../types';

/**
 * Transforms the TIVData into the flat dictionary expected by the Docx template.
 * Includes logic from the original Python script (title inversion, date formatting, etc).
 */
export const prepareTemplateData = (data: TIVData) => {
    // Logic: Invert Title (e.g., 2023-12345 -> 12345-2023)
    let tituloInvertido = data.titulo_numero;
    if (data.titulo_numero && data.titulo_numero.includes('-')) {
        const parts = data.titulo_numero.split('-');
        if (parts.length === 2) {
            // If second part is year (4 digits), swap
            if (parts[0].length === 4 && parts[1].length > 4) {
                 tituloInvertido = `${parts[1]}-${parts[0]}`;
            } 
            // Or if it matches the Python logic simple inversion
            else {
                tituloInvertido = `${parts[1]}-${parts[0]}`;
            }
        }
    }

    // Logic: Fecha Solo (Extract date part)
    const fechaSolo = data.fecha ? data.fecha.split(' ')[0] : '';

    // Logic: Zona Registral Completa
    const zonaCompleta = data.zona_registral ? `ZONA REGISTRAL N° ${data.zona_registral}` : '';

    return {
        Contador: data.codigo_verificacion || '',
        Placa: data.placa || '',
        Titulo_Invertido: tituloInvertido || '',
        Fecha: data.fecha || '',
        Zona_Registral_Completa: zonaCompleta,
        Sede_Registral: data.sede_registral || '',
        Partida_Nro: data.partida_registral || '',
        DUA: data.dua_dam || '',
        Titulo_Nro: data.titulo_numero || '',
        Fecha_Solo: fechaSolo,
        Cilindrada: data.cilindrada || '',
        Peso_Bruto: data.peso_bruto || '',
        Peso_Neto: data.peso_neto || '',
        Carga_Util: data.carga_util || '',
        Nro_Cilindros: data.cilindros || '',
        Longitud: data.longitud || '',
        Altura: data.altura || '',
        Ancho: data.ancho || '',
        Nro_Version: data.version || '',
        Tipo_Combustible: data.combustible || '',
        Formula_Rodante: data.form_rod || '',
        Potencia_Motor: data.potencia || '',
        Tipo_Carroceria: data.carroceria || '',
        Nro_Motor: data.numero_motor || '',
        Nro_Serie: data.numero_serie || '',
        Nro_VIN: data.numero_vin || '',
        Color: data.color || '',
        Nro_Asientos: data.asientos || '',
        Nro_Pasajeros: data.pasajeros || '',
        Nro_Ruedas: data.ruedas || '',
        Nro_Ejes: data.ejes || '',
        Año_Modelo: data.anio_modelo || '',
        Modelo: data.modelo || '',
        Marca: data.marca || '',
        Categoria: data.categoria || '',
    };
};

/**
 * Generates the filled DOCX file.
 * Returns a Promise that resolves to the Blob of the generated file.
 */
export const generateFilledDocument = async (templateFile: File, data: TIVData): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
        // Safely access globals from window
        const PizZip = (window as any).PizZip;
        const Docxtemplater = (window as any).docxtemplater || (window as any).Docxtemplater;

        if (!PizZip || !Docxtemplater) {
            reject(new Error("Las librerías de generación de documentos (PizZip, Docxtemplater) no se han cargado correctamente."));
            return;
        }

        const reader = new FileReader();
        
        reader.onerror = reject;
        
        reader.onload = function(evt) {
            try {
                const content = evt.target?.result;
                
                // 1. Load the docx file as a binary
                const zip = new PizZip(content);
                
                // 2. Parse the template
                // IMPORTANT: Configure delimiters to match the user's template format «Key»
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    delimiters: { start: '«', end: '»' }
                });

                // 3. Prepare data
                const templateData = prepareTemplateData(data);

                // 4. Render the document (replace variables)
                doc.render(templateData);

                // 5. Generate the output blob
                const out = doc.getZip().generate({
                    type: "blob",
                    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                });
                
                resolve(out);

            } catch (error) {
                console.error("Error generating document:", error);
                reject(error);
            }
        };

        reader.readAsBinaryString(templateFile);
    });
};