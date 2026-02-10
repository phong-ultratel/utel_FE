import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VisitTrackingService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Gửi 1 request lên backend để ghi nhận lượt truy cập.
   * Backend sẽ tự lấy domain từ header Origin/Referer, FE không cần gửi domain.
   * Việc chống đếm trùng (5 giây) được xử lý ở backend bằng HttpSession.
   * Để HttpSession hoạt động đúng, FE phải gửi kèm cookie (withCredentials: true).
   */
  trackVisit() {
    return this.http.post<void>(`${this.baseUrl}/visit`, {}, { withCredentials: true });
  }
}

