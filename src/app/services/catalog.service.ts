import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PackageCardDto } from '../models/package.model';
import { PackageDetailResponse } from '../models/package-detail.model';

export interface CatalogResponse {
  filters?: any;
  packages: PackageCardDto[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private baseUrl = environment.apiBaseUrl + '/api/public/catalog';

  constructor(private http: HttpClient) {}

  getPackages(params?: {
    provider?: string;
    packageType?: string;
    validityDays?: number;
    familyMode?: string;
  }): Observable<CatalogResponse> {
    let httpParams = new HttpParams();
    
    if (params?.provider) {
      httpParams = httpParams.set('provider', params.provider);
    }
    if (params?.packageType) {
      httpParams = httpParams.set('packageType', params.packageType);
    }
    if (params?.validityDays) {
      httpParams = httpParams.set('validityDays', params.validityDays.toString());
    }
    if (params?.familyMode) {
      httpParams = httpParams.set('familyMode', params.familyMode);
    }

    return this.http.get<CatalogResponse>(`${this.baseUrl}/packages`, { params: httpParams });
  }

  getPackageDetail(packageCode: string): Observable<PackageDetailResponse> {
    return this.http.get<PackageDetailResponse>(`${this.baseUrl}/packages/${packageCode}`);
  }
}

