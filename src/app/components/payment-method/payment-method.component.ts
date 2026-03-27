import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PaymentOption {
  id: string;
  name: string;
  icon: string;
  discount?: string;
}

@Component({
  selector: 'app-payment-method',
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.scss']
})
export class PaymentMethodComponent implements OnInit {
  @Input() totalAmount: number = 0;
  // Tỷ lệ chiết khấu (%), dùng cho rule giảm theo phần trăm
  @Input() discount: number = 0;
  // Số tiền chiết khấu cố định (VND), dùng cho rule giảm theo số tiền
  @Input() discountAmount: number = 0;
  // Text hiển thị chiết khấu (ví dụ "-20%" hoặc "(-20.000đ)"), ưu tiên dùng cho UI
  @Input() discountText: string | null = null;

  // Thông tin cần để tạo Order cho luồng thanh toán
  @Input() phoneNumber: string = '';
  @Input() sessionId: string = '';
  @Input() telecomPackageCodeSnapshot: string = '';
  @Input() telecomPackageNameSnapshot: string = '';
  @Output() back = new EventEmitter<void>();

  selectedPaymentMethod: string = '';
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

  paymentOptions: PaymentOption[] = [
    {
      id: 'qr-code',
      name: 'Quét mã QR',
      icon: 'qr-code',
      discount: 'Chiết khấu 5%'
    },
    {
      id: 'bank-transfer',
      name: 'Chuyển khoản',
      icon: '🏦',
      discount: 'Chiết khấu 5%'
    },
    {
      id: 'domestic-card',
      name: 'Thẻ nội địa',
      icon: '💳',
      discount: 'Chiết khấu 5%'
    },
    {
      id: 'international-card',
      name: 'Thẻ quốc tế',
      icon: 'visa',
      discount: 'Chiết khấu 5%'
    },
    {
      id: 'viettel-money',
      name: 'Viettel Money',
      icon: 'Viettel',
      discount: 'Chiết khấu 5%'
    }
  ];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // Set default selected payment method
    if (this.paymentOptions.length > 0) {
      this.selectedPaymentMethod = this.paymentOptions[0].id;
    }
  }

  selectPaymentMethod(methodId: string): void {
    this.selectedPaymentMethod = methodId;
  }

  calculateDiscount(): number {
    // Nếu có cấu hình giảm theo số tiền cố định, ưu tiên dùng discountAmount
    if (this.discountAmount && this.discountAmount > 0) {
      return this.discountAmount;
    }

    // Nếu giảm theo phần trăm
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

  continue(): void {
    if (!this.selectedPaymentMethod) {
      alert('Vui lòng chọn phương thức thanh toán');
      return;
    }

    if (this.selectedPaymentMethod === 'viettel-money') {
      this.startViettelMoneyFlow();
      return;
    }

    alert('Chưa hỗ trợ phương thức thanh toán này ở luồng demo.');
  }

  private startViettelMoneyFlow(): void {
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
    const orderCode = `ORDER_${Date.now()}`;

    const orderPayload = {
      orderCode,
      phoneNumber: this.phoneNumber,
      originalPrice,
      salePrice,
      status: 'INIT',
      paymentMethod: 'CARD',
      telecomPackageCodeSnapshot: this.telecomPackageCodeSnapshot,
      telecomPackageNameSnapshot: this.telecomPackageNameSnapshot,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString()
    };

    this.http.post<any>(`${environment.apiBaseUrl}/public/orders`, orderPayload).subscribe({
      next: (orderResp) => {
        const orderId = orderResp?.id;
        if (!orderId) {
          alert('Không tạo được Order. Vui lòng thử lại.');
          return;
        }

        const paymentReq = { orderId };
        this.http.post<any>(`${environment.apiBaseUrl}/payment/viettel-money/create`, paymentReq).subscribe({
          next: (payResp) => {
            const paymentUrl = payResp?.paymentUrl || payResp?.url || payResp?.redirectUrl;
            if (!paymentUrl) {
              alert('Không nhận được URL thanh toán từ Viettel. Vui lòng thử lại.');
              return;
            }
            window.location.href = paymentUrl;
          },
          error: (err) => {
            console.error('create payment failed', err);
            alert('Tạo thanh toán Viettel Money thất bại. Vui lòng thử lại.');
          }
        });
      },
      error: (err) => {
        console.error('create order failed', err);
        alert('Tạo đơn hàng thất bại. Vui lòng thử lại.');
      }
    });
  }

  onInvoiceCheckboxChange(event: any): void {
    if (event.target.checked) {
      this.showInvoiceModal = true;
    } else {
      // Nếu uncheck trực tiếp, đóng modal và reset data
      this.showInvoiceModal = false;
      this.resetInvoiceData();
      this.invoiceSubmitted = false;
    }
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    // Nếu đóng modal mà chưa submit, uncheck checkbox và reset data
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
    // Reset errors when switching type
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
    
    // Validate email format
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
    // Validate all fields
    if (!this.validateAllFields()) {
      return;
    }

    console.log('Invoice data:', {
      type: this.invoiceType,
      data: this.invoiceType === 'individual' 
        ? this.invoiceData.individual 
        : this.invoiceData.company
    });

    // Đóng modal sau khi submit thành công
    this.showInvoiceModal = false;
    // Giữ checkbox được tick và đánh dấu đã submit
    this.requestInvoice = true;
    this.invoiceSubmitted = true;
  }
}

