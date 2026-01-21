export interface PackageDisplay {
  dataText?: string;
  callText?: string;
  smsText?: string;
  benefitText?: string;
  specialInfo?: string;
}

export interface PackagePricing {
  originalPrice: number;
  salePrice: number;
  discountPercent?: number;
  discountValue?: number;
  discountText?: string;
}

export type PackageFamilyMode = 'STANDARD' | 'SPECIAL';
export type TelecomProviderCode = 'VIETTEL' | 'MOBI' | 'VINA';

export interface PackageCardDto {
  packageCode: string;
  displayName: string;
  providerCode?: string;
  validityDays: number;
  familyMode?: PackageFamilyMode;
  display?: PackageDisplay;
  pricing?: PackagePricing;
}

