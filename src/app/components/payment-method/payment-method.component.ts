import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AttributionService } from '../../services/attribution.service';
import { isLookupExpiredHttpError, LookupStateService } from '../../services/lookup-state.service';

export interface OrderPackageSnapshot {
  name?: string;
  duration?: string;
  dataInfo?: string;
  callInfo?: string;
  smsInfo?: string;
  specialInfo?: string;
  benefitDetail?: string;
  familyMode?: string;
  utilities?: Array<{ name: string; iconUrl?: string }>;
}

@Component({
  selector: 'app-payment-method',
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.scss']
})
export class PaymentMethodComponent {
  @Input() totalAmount: number = 0;
  @Input() discount: number = 0;
  @Input() discountAmount: number = 0;
  @Input() discountText: string | null = null;

  @Input() phoneNumber: string = '';
  @Input() sessionId: string = '';
  @Input() telecomPackageCodeSnapshot: string = '';
  @Input() telecomPackageNameSnapshot: string = '';
  @Input() carrierPrice: number = 0;
  @Input() packageSnapshot: OrderPackageSnapshot | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() lookupExpired = new EventEmitter<void>();

  isProcessingPayment: boolean = false;
  requestInvoice: boolean = false;
  showInvoiceModal: boolean = false;
  invoiceType: 'individual' | 'company' = 'individual';
  invoiceSubmitted: boolean = false;

  invoiceData = {
    individual: {
      buyerName: '',
      idCard: '',
      address: '',
      email: ''
    },
    company: {
      taxId: '',
      companyName: '',
      address: '',
      buyerName: '',
      email: ''
    }
  };

  errors = {
    individual: {
      buyerName: '',
      idCard: '',
      address: '',
      email: ''
    },
    company: {
      taxId: '',
      companyName: '',
      address: '',
      buyerName: '',
      email: ''
    }
  };

  constructor(
    private http: HttpClient,
    private attribution: AttributionService,
    private lookupState: LookupStateService
  ) {}

  getPackageDisplayName(): string {
    const name = this.packageSnapshot?.name || this.telecomPackageNameSnapshot || '';
    const duration = this.packageSnapshot?.duration?.trim();
    if (name && duration) {
      return `${name} - ${duration}`;
    }
    return name || '—';
  }

  formatDisplayPhone(phone: string): string {
    const raw = (phone || '').trim();
    if (!raw) {
      return '—';
    }
    if (raw.startsWith('84') && raw.length >= 11) {
      return '0' + raw.substring(2);
    }
    return raw;
  }

  hasPackageInfo(): boolean {
    const pkg = this.packageSnapshot;
    if (!pkg) {
      return false;
    }
    if (pkg.familyMode === 'SPECIAL' && pkg.specialInfo?.trim()) {
      return true;
    }
    return !!(
      pkg.dataInfo ||
      pkg.callInfo ||
      pkg.smsInfo ||
      (pkg.utilities && pkg.utilities.length > 0) ||
      pkg.benefitDetail
    );
  }

  getSmsDisplayText(smsInfo?: string): string {
    if (!smsInfo) {
      return '';
    }
    if (smsInfo.includes('9999')) {
      return 'Miễn phí SMS nội mạng';
    }
    return smsInfo;
  }

  getUtilitiesText(utilities?: Array<{ name: string; iconUrl?: string }>): string {
    if (!utilities || utilities.length === 0) {
      return '';
    }
    return utilities.map(u => u.name).join(', ');
  }

  formatCallInfo(callInfo?: string): string {
    if (!callInfo) {
      return '';
    }
    return callInfo.replace(/(\d+)p(\/| |$|\))/g, '$1 phút$2');
  }

  formatSpecialInfo(specialInfo?: string): string {
    if (!specialInfo || !specialInfo.trim()) {
      return specialInfo || '';
    }

    let text = specialInfo.trim();
    let prefix = '';
    let content = text;

    if (text.startsWith('Ưu đãi:')) {
      prefix = 'Ưu đãi:';
      content = text.substring('Ưu đãi:'.length).trim();
    }

    const parts = content.split(/\s*-\s+/).filter(p => p.trim());
    if (parts.length <= 1) {
      return text;
    }

    const formatted = parts.map(p => `- ${p.trim()}`).join('\n');
    return prefix ? `${prefix}\n${formatted}` : formatted;
  }

  calculateDiscount(): number {
    if (this.discountAmount && this.discountAmount > 0) {
      return this.discountAmount;
    }

    if (this.discount > 0) {
      return Math.round(this.totalAmount * (this.discount / 100));
    }

    return 0;
  }

  calculateTotal(): number {
    return this.totalAmount - this.calculateDiscount();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price);
  }

  goBack(): void {
    this.back.emit();
  }

  private buildInvoiceRequestSnapshot(): Record<string, unknown> {
    if (!this.requestInvoice || !this.invoiceSubmitted) {
      return { requestInvoice: false, invoiceType: this.invoiceType };
    }
    const individualTaxId = this.invoiceData.individual.idCard?.trim() ?? '';
    return {
      requestInvoice: true,
      invoiceType: this.invoiceType,
      individual: {
        ...this.invoiceData.individual,
        taxId: individualTaxId
      },
      company: { ...this.invoiceData.company }
    };
  }

  continue(): void {
    if (this.isProcessingPayment) {
      return;
    }

    if (this.requestInvoice && !this.invoiceSubmitted) {
      alert('Vui lòng hoàn tất thông tin xuất hóa đơn trong cửa sổ yêu cầu.');
      return;
    }

    this.startViettelMoneyFlow();
  }

  private startViettelMoneyFlow(): void {
    if (this.lookupState.isSessionExpired()) {
      this.lookupExpired.emit();
      return;
    }

    if (!this.phoneNumber || !this.sessionId) {
      alert('Thiếu thông tin số thuê bao / session. Vui lòng thử lại.');
      return;
    }
    if (!this.telecomPackageCodeSnapshot || !this.telecomPackageNameSnapshot) {
      alert('Thiếu thông tin gói cước. Vui lòng thử lại.');
      return;
    }

    const originalPrice = this.totalAmount;
    const salePrice = this.calculateTotal();
    const viettelPriceSnapshot = this.carrierPrice > 0 ? this.carrierPrice : originalPrice;
    const orderCode = `ORDER_${Date.now()}`;
    this.isProcessingPayment = true;

    const orderPayload = {
      orderCode,
      phoneNumber: this.phoneNumber,
      originalPrice,
      viettelPriceSnapshot,
      salePrice,
      status: 'INIT',
      paymentMethod: 'CARD',
      telecomPackageCodeSnapshot: this.telecomPackageCodeSnapshot,
      telecomPackageNameSnapshot: this.telecomPackageNameSnapshot,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      invoiceRequestSnapshot: this.buildInvoiceRequestSnapshot(),
      ...this.attribution.utmPayload()
    };

    this.http.post<any>(`${environment.apiBaseUrl}/public/orders`, orderPayload).subscribe({
      next: (orderResp) => {
        const orderId = orderResp?.id;
        if (!orderId) {
          this.isProcessingPayment = false;
          alert('Không tạo được Order. Vui lòng thử lại.');
          return;
        }

        const paymentReq = { orderId, sessionId: this.sessionId };
        this.http.post<any>(`${environment.apiBaseUrl}/payment/viettel-money/create`, paymentReq).subscribe({
          next: (payResp) => {
            const paymentUrl = payResp?.paymentUrl || payResp?.url || payResp?.redirectUrl;
            if (!paymentUrl) {
              this.isProcessingPayment = false;
              alert('Không nhận được URL thanh toán từ Viettel. Vui lòng thử lại.');
              return;
            }
            window.location.href = paymentUrl;
          },
          error: (err) => {
            this.isProcessingPayment = false;
            console.error('create payment failed', err);
            const status = err?.status;
            if (status === 429) {
              alert('Hệ thống đang xử lý nhiều yêu cầu. Vui lòng thử lại sau vài phút.');
              return;
            }
            alert('Tạo thanh toán Viettel Money thất bại. Vui lòng thử lại.');
          }
        });
      },
      error: (err) => {
        this.isProcessingPayment = false;
        console.error('create order failed', err);
        if (isLookupExpiredHttpError(err)) {
          this.lookupExpired.emit();
          return;
        }
        const title = (err as { error?: { title?: string } })?.error?.title;
        alert(title || 'Tạo đơn hàng thất bại. Vui lòng thử lại.');
      }
    });
  }

  onInvoiceCheckboxChange(event: any): void {
    if (event.target.checked) {
      this.showInvoiceModal = true;
    } else {
      this.showInvoiceModal = false;
      this.resetInvoiceData();
      this.invoiceSubmitted = false;
    }
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    if (!this.invoiceSubmitted) {
      this.requestInvoice = false;
      this.resetInvoiceData();
    }
  }

  resetInvoiceData(): void {
    this.invoiceData = {
      individual: {
        buyerName: '',
        idCard: '',
        address: '',
        email: ''
      },
      company: {
        taxId: '',
        companyName: '',
        address: '',
        buyerName: '',
        email: ''
      }
    };
    this.invoiceType = 'individual';
    this.clearErrors();
  }

  setInvoiceType(type: 'individual' | 'company'): void {
    this.invoiceType = type;
    this.clearErrors();
  }

  validateField(fieldType: 'individual' | 'company', fieldName: string, value: string): string {
    if (!value || value.trim() === '') {
      switch (fieldName) {
        case 'buyerName':
          return 'Vui lòng nhập họ tên người mua.';
        case 'idCard':
          return 'Vui lòng nhập số căn cước.';
        case 'address':
          return 'Vui lòng nhập địa chỉ.';
        case 'email':
          return 'Vui lòng nhập email.';
        case 'taxId':
          return 'Vui lòng nhập mã số thuế.';
        case 'companyName':
          return 'Vui lòng nhập tên công ty.';
        default:
          return 'Trường này là bắt buộc.';
      }
    }

    if (fieldName === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Vui lòng nhập email hợp lệ.';
      }
    }

    return '';
  }

  onFieldBlur(fieldType: 'individual' | 'company', fieldName: string): void {
    let value = '';
    if (fieldType === 'individual') {
      value = (this.invoiceData.individual as any)[fieldName] || '';
    } else {
      value = (this.invoiceData.company as any)[fieldName] || '';
    }
    const error = this.validateField(fieldType, fieldName, value);
    if (fieldType === 'individual') {
      (this.errors.individual as any)[fieldName] = error;
    } else {
      (this.errors.company as any)[fieldName] = error;
    }
  }

  clearErrors(): void {
    this.errors = {
      individual: {
        buyerName: '',
        idCard: '',
        address: '',
        email: ''
      },
      company: {
        taxId: '',
        companyName: '',
        address: '',
        buyerName: '',
        email: ''
      }
    };
  }

  validateAllFields(): boolean {
    this.clearErrors();
    let isValid = true;

    if (this.invoiceType === 'individual') {
      const fields = ['buyerName', 'idCard', 'address', 'email'] as const;
      fields.forEach(field => {
        const error = this.validateField('individual', field, this.invoiceData.individual[field]);
        this.errors.individual[field] = error;
        if (error) isValid = false;
      });
    } else {
      const fields = ['taxId', 'companyName', 'address', 'email'] as const;
      fields.forEach(field => {
        const error = this.validateField('company', field, this.invoiceData.company[field]);
        this.errors.company[field] = error;
        if (error) isValid = false;
      });
    }

    return isValid;
  }

  submitInvoiceForm(): void {
    if (!this.validateAllFields()) {
      return;
    }

    this.showInvoiceModal = false;
    this.requestInvoice = true;
    this.invoiceSubmitted = true;
  }
}
