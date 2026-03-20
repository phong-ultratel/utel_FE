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
  loading = false;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('orderId');
      this.orderId = raw ? Number(raw) : null;
      if (!this.orderId || Number.isNaN(this.orderId)) {
        this.error = 'Thiếu orderId.';
        return;
      }
      this.fetchOrder(this.orderId);
    });
  }

  private fetchOrder(id: number): void {
    this.loading = true;
    this.error = null;
    this.http.get<any>(`${environment.apiBaseUrl}/orders/${id}`).subscribe({
      next: (resp) => {
        this.order = resp;
        this.loading = false;
      },
      error: (err) => {
        console.error('fetch order failed', err);
        this.error = 'Không thể tải trạng thái đơn hàng.';
        this.loading = false;
      }
    });
  }
}

