import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit {
  order: any = null;
  orderId: number | null = null;
  paymentFlow: 'return' | 'cancel' | null = null;
  resultTitle = 'Kết quả giao dịch';
  resultMessage = 'Đang xử lý kết quả thanh toán.';
  loading = false;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('orderId');
      this.orderId = raw ? Number(raw) : null;
      const flow = params.get('paymentFlow');
      this.paymentFlow = flow === 'return' || flow === 'cancel' ? flow : null;

      this.updateResultMessage();

      if (this.orderId && !Number.isNaN(this.orderId)) {
        this.fetchOrder(this.orderId);
      } else {
        this.error = 'Không tìm thấy mã đơn hàng trong URL trả về.';
      }
    });
  }

  private fetchOrder(id: number): void {
    this.loading = true;
    // Không reset error ở đây để vẫn giữ thông báo hợp lệ nếu thiếu orderId
    this.http.get<any>(`${environment.apiBaseUrl}/public/orders/${id}/status`).subscribe({
      next: (resp) => {
        this.order = resp;
        this.loading = false;
      },
      error: (err) => {
        console.error('fetch order failed', err);
        this.error = 'Không thể tải chi tiết trạng thái đơn hàng.';
        this.loading = false;
      }
    });
  }

  private updateResultMessage(): void {
    if (this.paymentFlow === 'return') {
      this.resultTitle = 'Thanh toán đã được xử lý';
      this.resultMessage = 'Hệ thống đã nhận phản hồi từ cổng thanh toán. Trạng thái đơn hàng sẽ được cập nhật trong giây lát.';
      return;
    }
    if (this.paymentFlow === 'cancel') {
      this.resultTitle = 'Bạn đã hủy giao dịch';
      this.resultMessage = 'Giao dịch chưa hoàn tất. Bạn có thể quay lại và thực hiện thanh toán lại.';
      return;
    }
    this.resultTitle = 'Kết quả giao dịch';
    this.resultMessage = 'Đã quay về từ cổng thanh toán. Vui lòng kiểm tra trạng thái đơn hàng.';
  }
}

