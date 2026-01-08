import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

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
  @Input() discount: number = 0;
  @Output() back = new EventEmitter<void>();
  
  selectedPaymentMethod: string = '';
  requestInvoice: boolean = false;

  paymentOptions: PaymentOption[] = [
    {
      id: 'bank-transfer',
      name: 'Chuyển khoản',
      icon: '🏦',
      discount: 'Chiết khấu 5%'
    },
    {
      id: 'qr-code',
      name: 'Quét mã QR',
      icon: '📱',
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
      icon: '🌐',
      discount: 'Chiết khấu 5%'
    }
  ];

  constructor() { }

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
    
    console.log('Selected payment method:', this.selectedPaymentMethod);
    console.log('Request invoice:', this.requestInvoice);
    console.log('Total amount:', this.calculateTotal());
    
    // Xử lý tiếp tục thanh toán ở đây
  }
}

