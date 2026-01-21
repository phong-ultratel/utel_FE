import { PackageCardDto } from './package.model';

export interface SuggestedPackageDto {
  packageCode: string;
  displayName: string;
  validityDays: number;
  salePrice: number;
}

export interface PackageDetailResponse {
  package: PackageCardDto & {
    benefitDetail?: string;
    description?: string;
  };
  suggestedPackages: SuggestedPackageDto[];
}

