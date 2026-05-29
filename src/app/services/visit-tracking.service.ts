import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AttributionService } from './attribution.service';

/** Header dự phòng khi body JSON bị proxy/WAF làm rỗng — khớp backend VisitTrackingResource. */
export const VISITOR_SESSION_HEADER = 'X-Visitor-Session-Id';
export const VISIT_STATUS_HEADER = 'X-Visit-Status';

@Injectable({
  providedIn: 'root'
})
export class VisitTrackingService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient, private attribution: AttributionService) {}

  /**
   * Ghi nhận lượt truy cập kèm UTM và visitor session id thống nhất.
   * observe: 'response' để đọc X-Visit-Status (saved | skipped-no-session | skipped-dedup).
   */
  trackVisit() {
    const sessionId = this.attribution.getOrCreateVisitorSessionId();
    const body = {
      sessionId,
      ...this.attribution.utmPayload()
    };
    const headers = new HttpHeaders().set(VISITOR_SESSION_HEADER, sessionId);
    return this.http.post<void>(`${this.baseUrl}/visit`, body, {
      withCredentials: true,
      headers,
      observe: 'response'
    });
  }
}
