import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AttributionService } from './attribution.service';

export type PackageStatus = 'PENDING_CONFIG' | 'ACTIVE' | 'INACTIVE' | string;

export interface TelecomPackageFamilyDto {
  code: string;
  name: string;
  specialInfo?: string | null;
  benefitDetail?: string | null;
  packageFamilyMode?: 'STANDARD' | 'SPECIAL';
}

export interface TelecomPackageDto {
  packageCode: string;
  displayName: string;
  validityDays: number;
  originalPrice: number;
  status: PackageStatus;
  family?: TelecomPackageFamilyDto | null;
}

export interface TelcoLookupResponse {
  success: boolean;
  message: string;
  providerCode: string;
  eligiblePackageCodes: string[];
  packages: TelecomPackageDto[];
  group1: TelecomPackageDto[];
  group2: TelecomPackageDto[];
  group3: TelecomPackageDto[];
  group4: TelecomPackageDto[];
  /** Gói đề xuất (tối đa 3), đã lọc theo API tra cứu */
  recommendedPackages?: TelecomPackageDto[];
}

@Injectable({
  providedIn: 'root'
})
export class TelcoService {
  private baseUrl = environment.apiBaseUrl + '/public/telco';

  constructor(private http: HttpClient, private attribution: AttributionService) {}

  lookup(phoneNumber: string, sessionId?: string): Observable<TelcoLookupResponse> {
    const body: Record<string, string> = { phoneNumber, ...this.attribution.utmPayload() };
    if (sessionId) {
      body['sessionId'] = sessionId;
    }
    return this.http.post<TelcoLookupResponse>(`${this.baseUrl}/lookup`, body);
  }
}

