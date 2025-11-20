export interface TIVData {
  titulo_numero: string;
  fecha: string;
  zona_registral: string;
  sede_registral: string;
  partida_registral: string;
  dua_dam: string;
  placa: string;
  categoria: string;
  marca: string;
  modelo: string;
  color: string;
  numero_vin: string;
  numero_serie: string;
  numero_motor: string;
  carroceria: string;
  potencia: string;
  combustible: string;
  form_rod: string;
  version: string;
  anio_fabricacion: string;
  anio_modelo: string;
  asientos: string;
  pasajeros: string;
  ruedas: string;
  ejes: string;
  cilindros: string;
  cilindrada: string;
  longitud: string;
  altura: string;
  ancho: string;
  peso_bruto: string;
  peso_neto: string;
  carga_util: string;
  codigo_verificacion: string;
  qr_data?: string | null; // Field for verifiable QR content
}

export const EMPTY_TIV_DATA: TIVData = {
  titulo_numero: '',
  fecha: '',
  zona_registral: '',
  sede_registral: '',
  partida_registral: '',
  dua_dam: '',
  placa: '',
  categoria: '',
  marca: '',
  modelo: '',
  color: '',
  numero_vin: '',
  numero_serie: '',
  numero_motor: '',
  carroceria: '',
  potencia: '',
  combustible: '',
  form_rod: '',
  version: '',
  anio_fabricacion: '',
  anio_modelo: '',
  asientos: '',
  pasajeros: '',
  ruedas: '',
  ejes: '',
  cilindros: '',
  cilindrada: '',
  longitud: '',
  altura: '',
  ancho: '',
  peso_bruto: '',
  peso_neto: '',
  carga_util: '',
  codigo_verificacion: '',
  qr_data: null,
};

export interface ExtractionResult {
  data: TIVData;
  rawText?: string;
}