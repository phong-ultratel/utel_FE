import { Component, OnInit, AfterViewChecked, OnDestroy, ChangeDetectorRef } from '@angular/core';

interface DataPackage {
  id: number;
  name: string;
  data: string;
  dailyData?: string; // Data hàng ngày (ví dụ: "1GB/ngày")
  price: number; // Giá sau khuyến mại
  originalPrice?: number; // Giá gốc (nếu có khuyến mại)
  discountAmount?: number; // Mức khuyến mại theo số tiền (₫)
  discountPercent?: number; // Mức khuyến mại theo phần trăm (%)
  duration: string; // Hiển thị (ví dụ: "1 ngày", "30 ngày", "90 ngày")
  durationDays: number; // Số ngày để sắp xếp (ví dụ: 1, 30, 90)
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
  familyId?: string; // ID của family để nhóm các gói cùng thông tin nhưng khác thời hạn
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
export class DataPackagesComponent implements OnInit, AfterViewChecked, OnDestroy {
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
      durationDays: 1,
      color: '#0066CC',
      packageType: '4g5g',
      familyId: 'family-1'
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
      durationDays: 3,
      color: '#0066CC',
      packageType: '4g5g',
      familyId: 'family-1'
    },
    {
      id: 3,
      name: '3T5G160B',
      data: '120GB',
      dailyData: '4GB/ngày',
      dataInfo: '120GB (4GB/ngày)',
      callInfo: '100 phút gọi ngoại mạng. Miễn phí 10 phút đầu tiên của tất cả các cuộc gọi nội mạng (tối đa 1.000 phút)',
      smsInfo: '',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      originalPrice: 500000,
      price: 480000,
      discountPercent: 4,
      duration: '90 ngày',
      durationDays: 90,
      color: '#E60012',
      packageType: '4g5g',
      familyId: 'family-2'
    },
    {
      id: 4,
      name: '3T5G160B-30',
      data: '120GB',
      dailyData: '4GB/ngày',
      dataInfo: '120GB (4GB/ngày)',
      callInfo: '100 phút gọi ngoại mạng. Miễn phí 10 phút đầu tiên của tất cả các cuộc gọi nội mạng (tối đa 1.000 phút)',
      smsInfo: '',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      price: 180000,
      duration: '30 ngày',
      durationDays: 30,
      color: '#E60012',
      packageType: '4g5g',
      familyId: 'family-2'
    },
    {
      id: 5,
      name: '3T5G160B-7',
      data: '120GB',
      dailyData: '4GB/ngày',
      dataInfo: '120GB (4GB/ngày)',
      callInfo: '100 phút gọi ngoại mạng. Miễn phí 10 phút đầu tiên của tất cả các cuộc gọi nội mạng (tối đa 1.000 phút)',
      smsInfo: '',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      price: 50000,
      duration: '7 ngày',
      durationDays: 7,
      color: '#E60012',
      packageType: '4g5g',
      familyId: 'family-2'
    },
    {
      id: 6,
      name: '3T5GLQ1530N',
      data: '15GB',
      dailyData: '500MB/ngày',
      dataInfo: '500MB/ngày',
      callInfo: '300p ngoại mạng, 30p/cuộc nội',
      smsInfo: '300 SMS',
      price: 200000,
      duration: '30 ngày',
      durationDays: 30,
      color: '#0066CC',
      packageType: '4g5g',
      familyId: 'family-3'
    },
    {
      id: 7,
      name: '3T5GLQ3030N',
      data: '30GB',
      dailyData: '1GB/ngày',
      dataInfo: '1GB/ngày',
      callInfo: '500p ngoại mạng, 50p/cuộc nội',
      smsInfo: '500 SMS',
      utilities: [{ name: 'TV360' }],
      price: 350000,
      duration: '30 ngày',
      durationDays: 30,
      color: '#0066CC',
      packageType: '4g5g',
      familyId: 'family-4'
    },
    {
      id: 8,
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
      discountPercent: 9,
      duration: '7 ngày',
      durationDays: 7,
      color: '#E60012',
      packageType: '4g5g',
      familyId: 'family-5'
    },
    {
      id: 9,
      name: '3T5G160B-180',
      data: '120GB',
      dailyData: '4GB/ngày',
      dataInfo: '120GB (4GB/ngày)',
      callInfo: '100 phút gọi ngoại mạng. Miễn phí 10 phút đầu tiên của tất cả các cuộc gọi nội mạng (tối đa 1.000 phút)',
      smsInfo: '',
      promotions: ['TIKTOK', 'YOUTUBE', 'FACEBOOK'],
      utilities: [{ name: 'TV360' }],
      originalPrice: 500000,
      price: 480000,
      discountPercent: 4,
      duration: '180 ngày',
      durationDays: 180,
      color: '#E60012',
      packageType: '4g5g',
      familyId: 'family-2'
    },

  ];

  filteredPackages: DataPackage[] = [];
  packageCount: number = 0;
  subscriberNumber: string = '';
  showPaymentMethod: boolean = false;
  selectedPackage: DataPackage | null = null;
  expandedPackages: { [key: number]: boolean } = {};
  needsExpandIcon: { [key: number]: boolean } = {};
  private hasOverflow: { [key: number]: boolean } = {}; // Lưu trạng thái ban đầu
  private checkExpandIcons: boolean = true;
  private resizeListener?: () => void;
  showDetailModal: boolean = false;
  detailPackage: DataPackage | null = null;
  familyPackages: DataPackage[] = []; // Các gói trong cùng family
  selectedFamilyPackage: DataPackage | null = null; // Gói được chọn trong family

  constructor(private cdr: ChangeDetectorRef) {
    // Listen for window resize
    this.resizeListener = () => {
      if (window.innerWidth <= 768) {
        this.checkExpandIcons = true;
        setTimeout(() => {
          this.updateExpandIcons();
        }, 100);
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnInit(): void {
    this.applyFilters();
  }

  ngAfterViewChecked(): void {
    if (this.checkExpandIcons && window.innerWidth <= 768) {
      this.updateExpandIcons();
      this.checkExpandIcons = false;
    }
  }

  updateExpandIcons(): void {
    this.filteredPackages.forEach(pkg => {
      const element = document.getElementById(`info-list-${pkg.id}`);
      if (element) {
        // Kiểm tra khi chưa expanded
        if (!this.expandedPackages[pkg.id]) {
          // Kiểm tra xem nội dung có bị cắt không
          const hasOverflow = element.scrollHeight > element.clientHeight;
          this.hasOverflow[pkg.id] = hasOverflow;
          this.needsExpandIcon[pkg.id] = hasOverflow;
        } else {
          // Khi expanded, chỉ hiển thị icon nếu ban đầu đã bị cắt
          // (để có thể thu gọn lại)
          this.needsExpandIcon[pkg.id] = this.hasOverflow[pkg.id] || false;
        }
      }
    });
    this.cdr.detectChanges();
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
    // Reset và kiểm tra lại expand icons sau khi filter
    this.checkExpandIcons = true;
    setTimeout(() => {
      this.updateExpandIcons();
    }, 100);
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
    this.detailPackage = pkg;
    
    // Lọc các gói trong cùng family
    if (pkg.familyId) {
      this.familyPackages = this.packages.filter(
        p => p.familyId === pkg.familyId && p.id !== pkg.id
      );
      // Sắp xếp theo durationDays (từ ít ngày đến nhiều ngày)
      this.familyPackages.sort((a, b) => {
        return (a.durationDays || 0) - (b.durationDays || 0);
      });
      // Thêm gói hiện tại vào danh sách và sắp xếp lại toàn bộ
      this.familyPackages.push(pkg);
      this.familyPackages.sort((a, b) => {
        return (a.durationDays || 0) - (b.durationDays || 0);
      });
    } else {
      // Nếu không có familyId, chỉ hiển thị gói hiện tại
      this.familyPackages = [pkg];
    }
    
    this.selectedFamilyPackage = pkg;
    this.showDetailModal = true;
    // Ngăn scroll body khi modal mở
    document.body.style.overflow = 'hidden';
  }

  selectFamilyPackage(pkg: DataPackage): void {
    this.selectedFamilyPackage = pkg;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailPackage = null;
    this.familyPackages = [];
    this.selectedFamilyPackage = null;
    // Khôi phục scroll body
    document.body.style.overflow = 'auto';
  }

  registerFromModal(): void {
    if (this.selectedFamilyPackage) {
      this.closeDetailModal();
      this.selectPackage(this.selectedFamilyPackage);
    }
  }

  getUtilitiesText(utilities?: Array<{ name: string; iconUrl?: string }>): string {
    if (!utilities || utilities.length === 0) {
      return '';
    }
    return utilities.map(u => u.name).join(', ');
  }

  hasUtilities(pkg: DataPackage | null): boolean {
    return !!(pkg?.utilities && pkg.utilities.length > 0);
  }

  // Lấy thông tin chung của family (lấy từ gói đầu tiên)
  getFamilyInfo(): DataPackage | null {
    if (this.familyPackages.length > 0) {
      return this.familyPackages[0];
    }
    return this.selectedFamilyPackage;
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

  toggleExpand(pkgId: number): void {
    this.expandedPackages[pkgId] = !this.expandedPackages[pkgId];
    // Sau khi toggle, cập nhật lại trạng thái icon
    setTimeout(() => {
      this.updateExpandIcons();
    }, 300); // Đợi animation hoàn thành
  }

  isExpanded(pkgId: number): boolean {
    return !!this.expandedPackages[pkgId];
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
