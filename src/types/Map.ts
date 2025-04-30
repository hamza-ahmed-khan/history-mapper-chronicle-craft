
export interface CountryData {
  id: string;
  name: string;
  conquered: boolean;
  color?: string;
  customLabel?: string;
  labelPosition?: [number, number]; // x, y coordinates for custom label positioning
  isAnimating?: boolean;
}

export interface MapState {
  countries: Record<string, CountryData>;
  selectedCountry: string | null;
  zoom: {
    scale: number;
    translate: [number, number];
  };
  activeColor: string;
  isRecordingMode: boolean;
}

export interface MapSelectionProps {
  onCountrySelect: (countryId: string) => void;
  onColorChange: (color: string) => void;
  activeColor: string;
  selectedCountry: string | null;
  countryName?: string;
}
