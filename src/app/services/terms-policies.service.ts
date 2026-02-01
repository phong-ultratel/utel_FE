import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ContentPage {
  id?: number;
  code?: string;
  title?: string;
  content?: string;
  contentType?: string;
  version?: string;
  status?: string;
  effectiveFrom?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PolicySection {
  id: string;
  title: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class TermsPoliciesService {
  private openModalSubject = new Subject<string | undefined>();
  openModal$ = this.openModalSubject.asObservable();
  private apiBaseUrl = environment.apiBaseUrl;

  // Map section ID to ContentType
  private sectionToContentTypeMap: { [key: string]: string } = {
    'terms-of-use': 'TERMS_OF_USE',
    'purchase-terms': 'PURCHASE_TERMS',
    'payment-policy': 'PAYMENT_POLICY',
    'privacy-policy': 'PRIVACY_POLICY'
  };

  constructor(private http: HttpClient) {}

  openModal(sectionId?: string): void {
    this.openModalSubject.next(sectionId);
  }

  /**
   * Lấy tất cả published content pages
   */
  getAllPublishedContentPages(): Observable<ContentPage[]> {
    return this.http.get<ContentPage[]>(`${this.apiBaseUrl}/public/content-pages/published`).pipe(
      catchError(error => {
        console.error('Error fetching published content pages:', error);
        return of([]);
      })
    );
  }

  /**
   * Lấy published content page theo contentType
   */
  getPublishedContentByType(contentType: string): Observable<ContentPage | null> {
    return this.http.get<ContentPage>(`${this.apiBaseUrl}/public/content-pages/published/${contentType}`).pipe(
      catchError(error => {
        console.error(`Error fetching content page for type ${contentType}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Lấy tất cả policy sections từ API
   */
  getPolicySections(): Observable<PolicySection[]> {
    return this.getAllPublishedContentPages().pipe(
      map((contentPages: ContentPage[]) => {
        const sections: PolicySection[] = [];
        
        // Map từ ContentType sang section ID
        const contentTypeToSectionMap: { [key: string]: string } = {
          'TERMS_OF_USE': 'terms-of-use',
          'PURCHASE_TERMS': 'purchase-terms',
          'PAYMENT_POLICY': 'payment-policy',
          'PRIVACY_POLICY': 'privacy-policy'
        };

        // Tạo sections từ content pages
        contentPages.forEach(page => {
          if (page.contentType && contentTypeToSectionMap[page.contentType]) {
            sections.push({
              id: contentTypeToSectionMap[page.contentType],
              title: page.title || this.getDefaultTitle(page.contentType),
              content: page.content || ''
            });
          }
        });

        // Đảm bảo thứ tự: terms-of-use, purchase-terms, payment-policy, privacy-policy
        const order = ['terms-of-use', 'purchase-terms', 'payment-policy', 'privacy-policy'];
        return sections.sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
      }),
      catchError(error => {
        console.error('Error loading policy sections:', error);
        return of([]);
      })
    );
  }

  private getDefaultTitle(contentType: string): string {
    const titles: { [key: string]: string } = {
      'TERMS_OF_USE': 'Điều khoản sử dụng',
      'PURCHASE_TERMS': 'Điều khoản mua hàng',
      'PAYMENT_POLICY': 'Chính sách thanh toán',
      'PRIVACY_POLICY': 'Chính sách bảo vệ dữ liệu cá nhân'
    };
    return titles[contentType] || contentType;
  }
}

