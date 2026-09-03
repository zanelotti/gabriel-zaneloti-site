/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_ADS_CONVERSION_ID?: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_CALCULO_PASSCODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
