import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type ComplaintEntryPoint = 'PAYMENT_PAGE' | 'FOOTER';

export interface CustomerComplaintDefaults {
  entryPoint: ComplaintEntryPoint;
  /** Số thuê bao (ưu tiên dạng MSISDN từ đơn hàng / tra cứu) */
  phoneNumber?: string | null;
  customerName?: string | null;
  email?: string | null;
  relatedOrderId?: number | null;
  orderCode?: string | null;
  packageName?: string | null;
  paymentAmount?: number | null;
}

@Component({
  selector: 'app-customer-complaint-modal',
  templateUrl: './customer-complaint-modal.component.html',
  styleUrls: ['./customer-complaint-modal.component.scss']
})
export class CustomerComplaintModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() defaults: CustomerComplaintDefaults | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() successClose = new EventEmitter<void>();

  phoneNumber = '';
  customerName = '';
  email = '';
  content = '';
  entryPoint: ComplaintEntryPoint = 'FOOTER';
  relatedOrderId: number | null = null;

  orderCodeDisplay = '';
  packageNameDisplay = '';
  paymentAmountDisplay = '';

  submitting = false;
  error: string | null = null;
  success = false;

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.error = null;
      this.success = false;
      this.applyDefaults(this.defaults);
    }
  }

  private applyDefaults(d: CustomerComplaintDefaults | null): void {
    if (!d) {
      this.entryPoint = 'FOOTER';
      this.phoneNumber = '';
      this.customerName = '';
      this.email = '';
      this.content = '';
      this.relatedOrderId = null;
      this.orderCodeDisplay = '';
      this.packageNameDisplay = '';
      this.paymentAmountDisplay = '';
      return;
    }
    this.entryPoint = d.entryPoint;
    this.phoneNumber = this.normalizePhoneInput(d.phoneNumber);
    this.customerName = (d.customerName || '').trim();
    this.email = (d.email || '').trim();
    this.content = '';
    this.relatedOrderId = d.relatedOrderId ?? null;
    this.orderCodeDisplay = d.orderCode || '';
    this.packageNameDisplay = d.packageName || '';
    this.paymentAmountDisplay =
      d.paymentAmount != null && !Number.isNaN(Number(d.paymentAmount))
        ? new Intl.NumberFormat('vi-VN').format(Number(d.paymentAmount)) + ' ₫'
        : '';
    if (d.entryPoint === 'PAYMENT_PAGE' && !this.content.trim() && d.orderCode) {
      this.content = `Tôi cần hỗ trợ / khiếu nại liên quan đơn hàng ${d.orderCode}. `;
    }
  }

  /** Giữ số dạng 0xxxxxxxxx để khớp đơn hàng */
  private normalizePhoneInput(raw?: string | null): string {
    if (!raw || !String(raw).trim()) {
      return '';
    }
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) {
      return '';
    }
    const nine = digits.slice(-9).padStart(9, '0');
    return '0' + nine;
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  closeAfterSuccess(): void {
    this.close();
    this.successClose.emit();
  }

  /** Bản đồ khóa lỗi JHipster (error.*) từ API public/cskh-complaints → thông báo tiếng Việt. */
  private static readonly CSKH_PUBLIC_ERROR_MESSAGES: Record<string, string> = {
    'error.orderbadstatus':
      'Đơn hàng không ở trạng thái cho phép gửi khiếu nại từ trang thanh toán (cần đã thanh toán, đang xử lý hoặc hoàn tất).',
    'error.orderrequired': 'Thiếu mã đơn hàng liên quan.',
    'error.ordernotfound': 'Không tìm thấy đơn hàng.',
    'error.phonemismatch': 'Số thuê bao không khớp với đơn hàng.',
    'error.badentry': 'Thông tin gửi không hợp lệ.'
  };

  private formatHttpError(err: unknown): string {
    const fallback = 'Không gửi được khiếu nại. Vui lòng thử lại hoặc liên hệ hotline.';
    const e = (err as { error?: unknown })?.error;
    if (typeof e === 'string' && e.trim()) {
      return e.trim();
    }
    if (!e || typeof e !== 'object') {
      return fallback;
    }
    const body = e as Record<string, unknown>;
    const detail = typeof body['detail'] === 'string' ? body['detail'].trim() : '';
    const title = typeof body['title'] === 'string' ? body['title'].trim() : '';
    const message = typeof body['message'] === 'string' ? body['message'].trim() : '';

    if (detail) {
      return detail;
    }
    const mapped = message ? CustomerComplaintModalComponent.CSKH_PUBLIC_ERROR_MESSAGES[message] : undefined;
    if (mapped) {
      return mapped;
    }
    if (title && title !== 'Bad Request') {
      return title;
    }
    if (message) {
      return message;
    }
    if (title) {
      return title;
    }
    return fallback;
  }

  submit(): void {
    this.error = null;
    const phone = this.phoneNumber.trim();
    if (!phone) {
      this.error = 'Vui lòng nhập số thuê bao.';
      return;
    }
    if (!this.content.trim()) {
      this.error = 'Vui lòng nhập nội dung khiếu nại.';
      return;
    }
    if (this.entryPoint === 'PAYMENT_PAGE' && (this.relatedOrderId == null || Number.isNaN(Number(this.relatedOrderId)))) {
      this.error = 'Thiếu thông tin đơn hàng. Vui lòng tải lại trang.';
      return;
    }

    const body: Record<string, unknown> = {
      entryPoint: this.entryPoint,
      phoneNumber: phone,
      customerName: this.customerName.trim() || null,
      email: this.email.trim() || null,
      content: this.content.trim(),
      relatedOrderId: this.relatedOrderId
    };

    this.submitting = true;
    this.http.post(`${environment.apiBaseUrl}/public/cskh-complaints`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.success = true;
      },
      error: (err) => {
        this.submitting = false;
        this.error = this.formatHttpError(err);
      }
    });
  }
}
