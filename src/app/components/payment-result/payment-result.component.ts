import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LookupStateService } from '../../services/lookup-state.service';
import { CustomerComplaintDefaults } from '../customer-complaint-modal/customer-complaint-modal.component';

/** Phản hồi GET /public/orders/{id}/status */
export interface PublicOrderStatus {
  id: number;
  orderCode?: string;
  status?: string;
  completedAt?: string;
  phoneNumber?: string;
  telecomPackageNameSnapshot?: string;
  salePrice?: number;
}

@Component({
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit {
  order: PublicOrderStatus | null = null;
  orderId: number | null = null;
  paymentFlow: 'return' | 'cancel' | null = null;
  resultTitle = 'Kết quả giao dịch';
  resultMessage = 'Đang xử lý kết quả thanh toán.';
  loading = false;
  error: string | null = null;

  complaintModalVisible = false;
  complaintModalDefaults: CustomerComplaintDefaults | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private lookupState: LookupStateService
  ) {}

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
      next: (resp: PublicOrderStatus) => {
        this.order = resp;
        this.loading = false;
        if (this.isSuccessfulPaymentStatus(resp.status)) {
          this.lookupState.reset();
        }
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

  getStatusText(status?: string): string {
    if (!status) {
      return 'Đang xử lý';
    }
    const statusMap: { [key: string]: string } = {
      CREATED: 'Khởi tạo',
      INIT: 'Khởi tạo',
      PENDING: 'Đang xử lý',
      PROCESSING: 'Đang xử lý',
      PAID: 'Đã thanh toán',
      COMPLETED: 'Hoàn tất',
      FAILED: 'Thất bại',
      CANCELLED: 'Đã hủy',
      CANCELED: 'Đã hủy',
      EXPIRED: 'Hết hạn',
      REFUNDED: 'Đã hoàn tiền'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status?: string): string {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'PAID' || normalized === 'COMPLETED') {
      return 'status-success';
    }
    if (normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'EXPIRED') {
      return 'status-danger';
    }
    return 'status-warning';
  }

  /** Hiển thị thuê bao dạng 0xx xxx xxx */
  formatSubscriberPhone(phone?: string | null): string {
    if (!phone || !String(phone).trim()) {
      return '—';
    }
    const digits = String(phone).replace(/\D/g, '');
    const nine = digits.slice(-9).padStart(9, '0');
    return '0' + nine.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  formatPaymentAmount(value?: number | null): string {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    return new Intl.NumberFormat('vi-VN').format(Number(value)) + ' ₫';
  }

  private isSuccessfulPaymentStatus(status?: string): boolean {
    const s = (status || '').toUpperCase();
    return s === 'PAID' || s === 'COMPLETED';
  }

  /**
   * Hiển thị nút khiếu nại khi đơn đã thanh toán / hoàn tất hoặc đang xử lý sau thanh toán
   * (PAID, COMPLETED, PENDING, PROCESSING — khớp nhãn "Đang xử lý" trên giao diện).
   */
  canShowComplaint(): boolean {
    if (!this.order) {
      return false;
    }
    const s = (this.order.status || '').toUpperCase();
    if (!s) {
      return false;
    }
    return (
      s === 'PAID' ||
      s === 'COMPLETED' ||
      s === 'PENDING' ||
      s === 'PROCESSING'
    );
  }

  openComplaintModal(): void {
    if (!this.order?.id) {
      return;
    }
    this.complaintModalDefaults = {
      entryPoint: 'PAYMENT_PAGE',
      phoneNumber: this.order.phoneNumber,
      customerName: '',
      email: '',
      relatedOrderId: this.order.id,
      orderCode: this.order.orderCode,
      packageName: this.order.telecomPackageNameSnapshot,
      paymentAmount: this.order.salePrice != null ? Number(this.order.salePrice) : null
    };
    this.complaintModalVisible = true;
  }
}

