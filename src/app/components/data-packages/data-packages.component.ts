import { Component, OnInit } from '@angular/core';

interface DataPackage {
  id: number;
  name: string;
  data: string;
  dailyData?: string; // Data hàng ngày (ví dụ: "1GB/ngày")
  price: number; // Giá sau khuyến mại
  originalPrice?: number; // Giá gốc (nếu có khuyến mại)
  discountAmount?: number; // Mức khuyến mại theo số tiền (₫)
  discountPercent?: number; // Mức khuyến mại theo phần trăm (%)
  duration: string;
  // Thông tin Data
  dataInfo?: string; // Ví dụ: "1GB/ngày"
  // Thông tin Thoại
  callInfo?: string; // Ví dụ: "90p ngoại mạng, 10p/cuộc ngoại mạng"
  // Thông tin SMS
  smsInfo?: string; // Ví dụ: "100 SMS"
  // Ưu đãi (danh sách)
  promotions?: string[]; // Ví dụ: ["TIKTOK", "YOUTUBE", "FACEBOOK"]
  // Tiện ích (danh sách với icon)
  utilities?: Array<{
    name: string;
    iconUrl?: string;
  }>; // Ví dụ: [{name: "TV360", iconUrl: "..."}]
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
      dataInfo: '1GB/ngày',
      callInfo: '90p ngoại mạng, 10p/cuộc nội',
      smsInfo: '100 SMS',
      price: 20000,
      duration: '1 ngày',
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 2,
      name: '3T5GLQ390N',
      data: '3GB',
      dailyData: '1GB/ngày',
      dataInfo: '1GB/ngày',
      callInfo: '120p ngoại mạng, 15p/cuộc nội',
      smsInfo: '150 SMS',
      price: 50000,
      duration: '3 ngày',
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 3,
      name: '3T5GLQ190N',
      data: '7GB',
      dailyData: '7GB/ngày',
      dataInfo: '7GB/ngày',
      callInfo: '200p ngoại mạng, 20p/cuộc nội',
      smsInfo: '200 SMS',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      originalPrice: 600000,
      price: 570000,
      discountPercent: 5,
      duration: '90 ngày',
      color: '#E60012',
      packageType: '4g5g'
    },
    {
      id: 4,
      name: '3T5GLQ1530N',
      data: '15GB',
      dailyData: '500MB/ngày',
      dataInfo: '500MB/ngày',
      callInfo: '300p ngoại mạng, 30p/cuộc nội',
      smsInfo: '300 SMS',
      price: 200000,
      duration: '30 ngày',
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 5,
      name: '3T5GLQ3030N',
      data: '30GB',
      dailyData: '1GB/ngày',
      dataInfo: '1GB/ngày',
      callInfo: '500p ngoại mạng, 50p/cuộc nội',
      smsInfo: '500 SMS',
      utilities: [{ name: 'TV360' }],
      price: 350000,
      duration: '30 ngày',
      color: '#0066CC',
      packageType: '4g5g'
    },
    {
      id: 6,
      name: '3T5GLQ5030N',
      data: '50GB',
      dailyData: '1.67GB/ngày',
      dataInfo: '1.67GB/ngày',
      callInfo: '1000p ngoại mạng, 100p/cuộc nội',
      smsInfo: '1000 SMS',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      originalPrice: 550000,
      price: 500000,
      discountAmount: 50000,
      duration: '7 ngày',
      color: '#E60012',
      packageType: '4g5g'
    }
  ];

  filteredPackages: DataPackage[] = [];
  packageCount: number = 0;
  subscriberNumber: string = '';
  showPaymentMethod: boolean = false;
  selectedPackage: DataPackage | null = null;

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

  hasDiscount(pkg: DataPackage): boolean {
    return !!(pkg.originalPrice || pkg.discountAmount || pkg.discountPercent);
  }

  getOriginalPrice(pkg: DataPackage): number {
    if (pkg.originalPrice) {
      return pkg.originalPrice;
    }
    // Nếu có discountAmount hoặc discountPercent, tính ngược lại giá gốc
    if (pkg.discountAmount) {
      return pkg.price + pkg.discountAmount;
    }
    if (pkg.discountPercent) {
      return Math.round(pkg.price / (1 - pkg.discountPercent / 100));
    }
    return pkg.price;
  }

  getDiscountDisplay(pkg: DataPackage): string {
    if (pkg.discountPercent) {
      return `-${pkg.discountPercent}%`;
    }
    if (pkg.discountAmount) {
      return `-${this.formatPrice(pkg.discountAmount)}₫`;
    }
    // Tính từ originalPrice và price
    if (pkg.originalPrice && pkg.originalPrice > pkg.price) {
      const discount = pkg.originalPrice - pkg.price;
      const percent = Math.round((discount / pkg.originalPrice) * 100);
      return `-${percent}%`;
    }
    return '';
  }

  selectPackage(pkg: DataPackage): void {
    console.log('Selected package:', pkg);
    this.selectedPackage = pkg;
    this.showPaymentMethod = true;
    // Scroll to top để hiển thị payment method
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToPackages(): void {
    this.showPaymentMethod = false;
    this.selectedPackage = null;
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

  getUtilityIconUrl(utilityName: string): string | null {
    const iconMap: { [key: string]: string } = {
      'TV360': 'http://media.vietteltelecom.vn/upload/ckfinder/files/TV360.png',
      'Tiktok': 'http://media.vietteltelecom.vn/upload/ckfinder/files/Tiktok.png',
      'Youtube': 'http://media.vietteltelecom.vn/upload/ckfinder/files/Youtube.png',
      'Facebook': 'http://media.vietteltelecom.vn/upload/ckfinder/files/Facebook.png'
    };
    return iconMap[utilityName] || null;
  }
}
