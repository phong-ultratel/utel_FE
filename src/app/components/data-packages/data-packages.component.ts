import { Component, OnInit } from '@angular/core';

interface DataPackage {
  id: number;
  name: string;
  data: string;
  dailyData?: string; // Data hàng ngày (ví dụ: "7GB/ngày")
  price: number;
  duration: string;
  features: string[];
  promotion?: string; // Ưu đãi (ví dụ: "Liên Quân Mobile")
  utility?: string; // Tiện ích (ví dụ: "TV360")
  popular?: boolean;
  color: string;
  packageType?: string; // '4g5g', '5g', 'hot', 'dcom', 'roaming'
}

interface PackageType {
  id: string;
  label: string;
}

@Component({
  selector: 'app-data-packages',
  templateUrl: './data-packages.component.html',
  styleUrls: ['./data-packages.component.scss']
})
export class DataPackagesComponent implements OnInit {
  packageTypes: PackageType[] = [
    { id: '4g5g', label: 'Gói cước 4G/5G' },
    { id: '5g', label: 'Gói cước 5G' },
    { id: 'hot', label: 'Gói cước Hot' },
    { id: 'dcom', label: 'Gói cước Dcom' },
    { id: 'roaming', label: 'Gói Roaming' }
  ];

  selectedPackageType: string = '4g5g';
  selectedDuration: string = '30';
  selectedPriceSort: string | null = 'asc';

  packages: DataPackage[] = [
    {
      id: 1,
      name: '3T5GLQ190N',
      data: '1GB',
      dailyData: '1GB/ngày',
      price: 20000,
      duration: '1 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt'],
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 2,
      name: '3T5GLQ390N',
      data: '3GB',
      dailyData: '1GB/ngày',
      price: 50000,
      duration: '3 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt'],
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 3,
      name: '3T5GLQ190N',
      data: '7GB',
      dailyData: '7GB/ngày',
      price: 570000,
      duration: '90 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ'],
      promotion: 'Liên Quân Mobile',
      utility: 'TV360',
      color: '#E60012',
      packageType: '4g5g'
    },
    {
      id: 4,
      name: '3T5GLQ1530N',
      data: '15GB',
      dailyData: '500MB/ngày',
      price: 200000,
      duration: '30 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 100 phút gọi'],
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 5,
      name: '3T5GLQ3030N',
      data: '30GB',
      dailyData: '1GB/ngày',
      price: 350000,
      duration: '30 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 200 phút gọi'],
      utility: 'TV360',
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 6,
      name: '3T5GLQ5030N',
      data: '50GB',
      dailyData: '1.67GB/ngày',
      price: 500000,
      duration: '7 ngày',
      features: ['Tốc độ 4G/5G', 'Không giới hạn tốc độ', 'Hết data tự động tắt', 'Ưu tiên tốc độ', 'Miễn phí 300 phút gọi', 'Tặng 5GB data'],
      promotion: 'Liên Quân Mobile',
      utility: 'TV360',
      color: '#E60012',
      packageType: '4g5g'
    }
  ];

  filteredPackages: DataPackage[] = [];
  packageCount: number = 0;
  subscriberNumber: string = '';

  constructor() { }

  ngOnInit(): void {
    this.applyFilters();
  }

  selectPackageType(typeId: string): void {
    this.selectedPackageType = typeId;
    this.applyFilters();
  }

  selectDuration(duration: string): void {
    this.selectedDuration = duration;
    this.applyFilters();
  }

  togglePriceSort(): void {
    if (this.selectedPriceSort === 'asc') {
      this.selectedPriceSort = 'desc';
    } else {
      this.selectedPriceSort = 'asc';
    }
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = [...this.packages];

    // Filter by package type
    filtered = filtered.filter(pkg => 
      (pkg.packageType || '4g5g') === this.selectedPackageType
    );

    // Filter by duration
    if (this.selectedDuration !== 'all') {
      if (this.selectedDuration === '30') {
        filtered = filtered.filter(pkg => pkg.duration.includes('30 ngày'));
      } else if (this.selectedDuration === 'long') {
        filtered = filtered.filter(pkg => {
          const match = pkg.duration.match(/(\d+)\s*ngày/);
          if (match) {
            const days = parseInt(match[1]);
            return days > 30;
          }
          return false;
        });
      }
    }

    // Sort by price
    if (this.selectedPriceSort) {
      filtered.sort((a, b) => {
        return this.selectedPriceSort === 'asc' 
          ? a.price - b.price 
          : b.price - a.price;
      });
    }

    this.filteredPackages = filtered;
    this.packageCount = filtered.length;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price);
  }

  selectPackage(pkg: DataPackage): void {
    console.log('Selected package:', pkg);
    // Xử lý đăng ký gói ở đây
  }

  viewDetails(pkg: DataPackage): void {
    console.log('View details for package:', pkg);
    // Xử lý xem chi tiết gói ở đây
  }

  handleLogin(): void {
    if (this.subscriberNumber.trim()) {
      console.log('Login with subscriber number:', this.subscriberNumber);
      // Xử lý đăng nhập ở đây
    }
  }
}
