import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LookupStateService } from '../../services/lookup-state.service';
import { CustomerComplaintDefaults } from '../customer-complaint-modal/customer-complaint-modal.component';

/** Phản hồi GET /public/orders/{token}/status */
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
export class PaymentResultComponent implements OnInit, OnDestroy {
  private static readonly POLL_INTERVAL_MS = 3000;
  private static readonly POLL_TIMEOUT_MS = 180_000;
  private static readonly TERMINAL_STATUSES = new Set([
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'CANCELED',
    'REFUNDED',
    'EXPIRED',
    'MANUALLY_HANDLED'
  ]);

  order: PublicOrderStatus | null = null;
  accessToken: string | null = null;
  paymentFlow: 'return' | 'cancel' | null = null;
  resultTitle = 'Kết quả giao dịch';
  resultMessage = 'Đang xử lý kết quả thanh toán.';
  loading = false;
  error: string | null = null;
  polling = false;
  pollTimedOut = false;

  complaintModalVisible = false;
  complaintModalDefaults: CustomerComplaintDefaults | null = null;

  private pollSub?: Subscription;
  private pollTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private lookupState: LookupStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.accessToken = (params.get('token') || '').trim() || null;
      const flow = params.get('paymentFlow');
      this.paymentFlow = flow === 'return' || flow === 'cancel' ? flow : null;

      this.updateResultMessage();

      if (this.accessToken) {
        this.startPolling(this.accessToken);
      } else {
        this.stopPolling();
        this.error = 'Không tìm thấy mã truy cập đơn hàng trong URL trả về.';
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(token: string): void {
    this.stopPolling();
    this.loading = true;
    this.pollTimedOut = false;
    this.polling = true;

    const sessionId = this.lookupState.getOrCreateSessionId();
    const params = new HttpParams().set('sessionId', sessionId);

    this.pollSub = timer(0, PaymentResultComponent.POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http
            .get<PublicOrderStatus>(`${environment.apiBaseUrl}/public/orders/${encodeURIComponent(token)}/status`, { params })
            .pipe(
              catchError((err) => {
                this.handleOrderFetchError(err);
                return of(null);
              })
            )
        )
      )
      .subscribe({
        next: (resp) => {
          if (resp) {
            this.handleOrderResponse(resp);
          }
        }
      });

    this.pollTimeoutId = setTimeout(() => {
      if (this.polling && !this.isTerminalStatus(this.order?.status)) {
        this.pollTimedOut = true;
        this.stopPolling();
      }
    }, PaymentResultComponent.POLL_TIMEOUT_MS);
  }

  private stopPolling(): void {
    this.polling = false;
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    if (this.pollTimeoutId != null) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = undefined;
    }
  }

  private handleOrderResponse(resp: PublicOrderStatus): void {
    this.order = resp;
    this.loading = false;

    if (this.isSuccessfulPaymentStatus(resp.status)) {
      this.lookupState.reset();
    }

    if (this.isTerminalStatus(resp.status)) {
      this.stopPolling();
    }
  }

  private handleOrderFetchError(err: unknown): void {
    console.error('fetch order failed', err);
    this.loading = false;

    const status = (err as { status?: number })?.status;
    if (status === 403) {
      this.error = 'Liên kết tra cứu đơn hàng đã hết hạn. Vui lòng kiểm tra lịch sử giao dịch hoặc liên hệ hỗ trợ.';
      this.stopPolling();
      return;
    }
    if (status === 429) {
      this.error = 'Hệ thống đang xử lý nhiều yêu cầu. Vui lòng thử lại sau vài phút.';
      return;
    }

    if (!this.order) {
      this.error = 'Không thể tải chi tiết trạng thái đơn hàng.';
      this.stopPolling();
    }
  }

  isPollingStatus(): boolean {
    return this.polling && !!this.order && !this.isTerminalStatus(this.order.status);
  }

  private isTerminalStatus(status?: string): boolean {
    return PaymentResultComponent.TERMINAL_STATUSES.has((status || '').toUpperCase());
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
   * Hiển thị nút khiếu nại khi đơn đã thanh toán / hoàn tất, đang xử lý sau thanh toán,
   * hoặc thanh toán thất bại (FAILED).
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
      s === 'PROCESSING' ||
      s === 'FAILED'
    );
  }

  /** Nhãn nút: đơn thất bại dùng "Báo cáo/ Khiếu nại", các trường hợp khác giữ nguyên. */
  getComplaintButtonLabel(): string {
    const s = (this.order?.status || '').toUpperCase();
    return s === 'FAILED' ? 'Báo cáo/ Khiếu nại' : 'Báo lỗi / Khiếu nại';
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

  onComplaintSuccessClose(): void {
    this.router.navigateByUrl('/');
  }
}
