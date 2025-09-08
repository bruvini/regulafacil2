// Firebase Collection Path Constants - Single Source of Truth
// All Firestore collection paths MUST use these constants

const BASE_PATH = "artifacts/regulafacil/public/data";

export const SECTORS_COLLECTION_PATH = `${BASE_PATH}/setores`;
export const BEDS_COLLECTION_PATH = `${BASE_PATH}/leitos`;
export const ROOMS_COLLECTION_PATH = `${BASE_PATH}/quartos`;
export const PATIENTS_COLLECTION_PATH = `${BASE_PATH}/pacientes`;
export const AUDIT_COLLECTION_PATH = `${BASE_PATH}/auditoria`;

// Export individual path components for flexibility
export const APP_ID = 'regulafacil';
export const BASE_ARTIFACTS_PATH = 'artifacts';
export const PUBLIC_DATA_PATH = 'public/data';