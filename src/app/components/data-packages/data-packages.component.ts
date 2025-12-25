import { Component, OnInit } from '@angular/core';

interface DataPackage {
  id: number;
  name: string;
  data: string;
  price: number;
  duration: string;
  features: string[];
  popular?: boolean;
  color: string;
}

@Component({
  selector: 'app-data-packages',
  templateUrl: './data-packages.component.html',
  styleUrls: ['./data-packages.component.scss']
})
export class DataPackagesComponent implements OnInit {
  packages: DataPackage[] = [
    {
      id: 1,
      name: 'Gói Data 1GB',
      data: '1GB',
      price: 20000,
      duration: '1 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt'],
      color: '#0066CC'
    },
    {
      id: 2,
      name: 'Gói Data 3GB',
      data: '3GB',
      price: 50000,
      duration: '3 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt'],
      color: '#0066CC'
    },
    {
      id: 3,
      name: 'Gói Data 7GB',
      data: '7GB',
      price: 100000,
      duration: '7 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ'],
      popular: true,
      color: '#E60012'
    },
    {
      id: 4,
      name: 'Gói Data 15GB',
      data: '15GB',
      price: 200000,
      duration: '30 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 100 phút gọi'],
      color: '#0066CC'
    },
    {
      id: 5,
      name: 'Gói Data 30GB',
      data: '30GB',
      price: 350000,
      duration: '30 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 200 phút gọi'],
      color: '#0066CC'
    },
    {
      id: 6,
      name: 'Gói Data 50GB',
      data: '50GB',
      price: 500000,
      duration: '30 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 300 phút gọi', 'Tặng 5GB data'],
      popular: true,
      color: '#E60012'
    }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price);
  }

  selectPackage(pkg: DataPackage): void {
    console.log('Selected package:', pkg);
    // Xử lý đăng ký gói ở đây
  }
}
