import {Component, OnInit, AfterViewChecked, OnDestroy, ChangeDetectorRef} from '@angular/core';
import {CatalogService} from '../../services/catalog.service';
import {SearchService} from '../../services/search.service';
import {PackageCardDto, TelecomProviderCode, CallRaw} from '../../models/package.model';
import {PackageDetailResponse, SuggestedPackageDto} from '../../models/package-detail.model';
import {Subject, takeUntil} from 'rxjs';

// Interface tương thích với template hiện tại
interface DisplayPackage extends PackageCardDto {
  id: number; // Dùng index hoặc hash của packageCode
  name: string; // Alias cho displayName
  price: number; // Alias cho pricing.salePrice
  originalPrice?: number; // Alias cho pricing.originalPrice
  discountPercent?: number; // Tính từ pricing
  discountAmount?: number; // Tính từ pricing
  duration: string; // Format từ validityDays
  durationDays: number; // Alias cho validityDays
  dataInfo?: string; // Alias cho display.dataText
  callInfo?: string; // Alias cho display.callText
  smsInfo?: string; // Alias cho display.smsText
  smsText?: string; // Giữ cả hai để tương thích
  specialInfo?: string; // Thông tin đặc biệt cho SPECIAL mode
  benefitDetail?: string; // Chi tiết ưu đãi từ family.benefitDetail
  utilities?: Array<{ name: string; iconUrl?: string }>; // Parse từ display.benefitText
  packageType?: string; // Lấy từ packageGroups hoặc filter
  familyId?: string; // Dùng family code hoặc packageCode prefix
  color?: string; // Màu mặc định
  popular?: boolean; // Gói phổ biến
}

interface PackageType {
  id: string;
  label: string;
}

interface TelecomProvider {
  code: TelecomProviderCode;
  name: string;
  logo: string;
}

interface PackageGroup {
  label: string;
  durationKey: string;
  packages: DisplayPackage[];
  totalCount: number;
}

@Component({
  selector: 'app-data-packages',
  templateUrl: './data-packages.component.html',
  styleUrls: ['./data-packages.component.scss']
})
export class DataPackagesComponent implements OnInit, AfterViewChecked, OnDestroy {
  providers: TelecomProvider[] = [
    {
      code: 'VIETTEL',
      name: 'Viettel',
      logo: 'assets/images/telecom_provider_logo/viettel.png'
    },
    {
      code: 'MOBI',
      name: 'Mobifone',
      logo: 'assets/images/telecom_provider_logo/mobiphone.png'
    },
    {
      code: 'VINA',
      name: 'Vinaphone',
      logo: 'assets/images/telecom_provider_logo/vinaphone.png'
    }
  ];

  packageTypes: PackageType[] = [
    {id: '4g5g', label: 'Gói cước 4G/5G'},
    {id: '5g', label: 'Gói cước 5G'},
    {id: 'hot', label: 'Gói cước Hot'},
    {id: 'dcom', label: 'Gói cước Dcom'},
    {id: 'roaming', label: 'Gói Roaming'}
  ];

  selectedProvider: TelecomProviderCode = 'VIETTEL';
  // Chuẩn bị sẵn cấu trúc để khóa nhà mạng sau khi tra cứu thuê bao (logic sẽ bổ sung sau)
  isProviderLocked: boolean = false;

  selectedPackageType: string = '4g5g';
  selectedDuration: string = 'all'; // Mặc định hiển thị tất cả
  selectedPriceSort: string | null = 'asc';

  packages: DisplayPackage[] = [];
  filteredPackages: DisplayPackage[] = [];
  packageCount: number = 0;
  groupedPackages: PackageGroup[] = [];
  subscriberNumber: string = '';
  showPaymentMethod: boolean = false;
  selectedPackage: DisplayPackage | null = null;
  expandedPackages: { [key: number]: boolean } = {};
  needsExpandIcon: { [key: number]: boolean } = {};
  private hasOverflow: { [key: number]: boolean } = {};
  private checkExpandIcons: boolean = true;
  private resizeListener?: () => void;
  showDetailModal: boolean = false;
  detailPackage: DisplayPackage | null = null;
  familyPackages: DisplayPackage[] = [];
  selectedFamilyPackage: DisplayPackage | null = null;
  suggestedPackages: SuggestedPackageDto[] = [];
  familyInfoPackage: DisplayPackage | null = null; // Package đầy đủ thông tin để hiển thị ưu đãi
  loading: boolean = false;
  error: string | null = null;
  searchQuery: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private cdr: ChangeDetectorRef,
    private catalogService: CatalogService,
    private searchService: SearchService
  ) {
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
    this.loadPackages();

    // Subscribe search query từ header
    this.searchService.searchQuery$
      .pipe(takeUntil(this.destroy$))
      .subscribe(query => {
        this.searchQuery = query;
        this.applyFilters();
      });
  }

  onProviderChange(provider: TelecomProviderCode): void {
    if (this.selectedProvider === provider || this.isProviderLocked) {
      return;
    }
    this.selectedProvider = provider;
    // Clear search khi đổi nhà mạng để hiển thị tất cả gói của nhà mạng mới
    this.searchService.clearSearch();
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading = true;
    this.error = null;

    this.catalogService.getPackages({
      provider: this.selectedProvider
      // Không filter familyMode để lấy cả STANDARD và SPECIAL
    }).subscribe({
      next: (response) => {
        console.log('API Response:', response);
        console.log('Packages count:', response.packages?.length || 0);

        if (!response.packages || response.packages.length === 0) {
          this.error = 'Không có gói cước nào.';
          this.packages = [];
          this.filteredPackages = [];
          this.packageCount = 0;
          this.loading = false;
          return;
        }

        this.packages = response.packages.map((pkg, index) => this.convertToDisplayPackage(pkg, index));
        console.log('Converted packages:', this.packages.length);
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading packages:', err);
        this.error = 'Không thể tải danh sách gói cước. Vui lòng thử lại sau.';
        this.packages = [];
        this.filteredPackages = [];
        this.packageCount = 0;
        this.loading = false;
      }
    });
  }

  /**
   * Tạo ID unique từ packageCode
   */
  private generateId(packageCode: string): number {
    // Hash đơn giản từ packageCode để tạo ID stable
    let hash = 0;
    for (let i = 0; i < packageCode.length; i++) {
      const char = packageCode.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Convert PackageCardDto từ API sang DisplayPackage cho template
   */
  private convertToDisplayPackage(pkg: PackageCardDto, index: number): DisplayPackage {
    const pricing = pkg.pricing || {originalPrice: 0, salePrice: 0};
    const display = pkg.display || {};
    const raw = pkg.raw;

    // Tính discount
    let discountPercent: number | undefined;
    let discountAmount: number | undefined;
    if (pricing.originalPrice && pricing.salePrice && pricing.originalPrice > pricing.salePrice) {
      discountAmount = pricing.originalPrice - pricing.salePrice;
      discountPercent = Math.round((discountAmount / pricing.originalPrice) * 100);
    }

    // Parse utilities từ benefitText (nếu có)
    const utilities = this.parseUtilities(display.benefitText);

    // Build callInfo: ưu tiên display.callText, nếu null thì build từ raw.call
    let callInfo = display.callText;
    if (!callInfo && raw?.call) {
      callInfo = this.buildCallInfoFromRaw(raw.call);
    }

    // Xử lý SPECIAL mode: nếu có specialInfo, set vào specialInfo
    // Vẫn có thể có callInfo từ raw.call nếu có
    const isSpecialMode = pkg.familyMode === 'SPECIAL';
    const specialInfo = isSpecialMode ? display.specialInfo : undefined;

    // Lấy benefitDetail nếu có (từ PackageDetailResponse)
    const benefitDetail = (pkg as any).benefitDetail;

    return {
      ...pkg,
      id: this.generateId(pkg.packageCode),
      name: pkg.displayName,
      price: pricing.salePrice,
      originalPrice: pricing.originalPrice > pricing.salePrice ? pricing.originalPrice : undefined,
      discountPercent,
      discountAmount,
      duration: `${pkg.validityDays} ngày`,
      durationDays: pkg.validityDays,
      dataInfo: display.dataText,
      callInfo: callInfo,
      smsInfo: display.smsText,
      smsText: display.smsText,
      specialInfo: specialInfo,
      benefitDetail: benefitDetail,
      utilities,
      packageType: this.selectedPackageType, // Có thể map từ packageGroups
      familyId: pkg.packageCode.split('-')[0], // Hoặc dùng family code nếu có
      color: '#0066CC', // Màu mặc định, có thể map từ providerCode
      popular: false // Có thể set dựa trên logic (ví dụ: dựa trên số lượng bán)
    };
  }

  /**
   * Build callInfo từ raw.call data khi display.callText null
   * Format: "10p/cuộc nội mạng" hoặc "10p/cuộc nội mạng (tối đa 500p)"
   */
  private buildCallInfoFromRaw(callRaw: CallRaw): string | undefined {
    if (!callRaw) {
      return undefined;
    }

    const hasOffNet = callRaw.offNetCallMinutes != null;
    const hasOnNet = callRaw.onNetCallMinutes != null;
    const hasOnNetLimit = callRaw.onNetCallLimitPerCall != null;

    if (!hasOffNet && !hasOnNet && !hasOnNetLimit) {
      return undefined;
    }

    const parts: string[] = [];

    // Off-net call
    if (hasOffNet) {
      parts.push(`${callRaw.offNetCallMinutes} phút ngoại mạng`);
    }

    // On-net call với limit per call
    if (hasOnNetLimit) {
      const limitText = `${callRaw.onNetCallLimitPerCall}p/cuộc nội mạng`;
      if (hasOnNet) {
        parts.push(`${limitText} (tối đa ${callRaw.onNetCallMinutes}p)`);
      } else {
        parts.push(limitText);
      }
    } else if (hasOnNet) {
      parts.push(`${callRaw.onNetCallMinutes}p nội mạng`);
    }

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  /**
   * Parse utilities từ benefitText (ví dụ: "TV360, TIKTOK, YOUTUBE")
   */
  private parseUtilities(benefitText?: string): Array<{ name: string; iconUrl?: string }> | undefined {
    if (!benefitText) {
      return undefined;
    }

    // Tìm các utility names trong benefitText
    const utilityNames = ['TV360', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'META', 'MYTV', 'VIEON', 'KASPERSKY'];
    const found: Array<{ name: string; iconUrl?: string }> = [];

    utilityNames.forEach(name => {
      if (benefitText.toUpperCase().includes(name)) {
        found.push({name});
      }
    });

    return found.length > 0 ? found : undefined;
  }

  ngAfterViewChecked(): void {
    if (this.checkExpandIcons && window.innerWidth <= 768) {
      this.updateExpandIcons();
      this.checkExpandIcons = false;
    }
  }

  updateExpandIcons(): void {
    // Lấy danh sách packages cần kiểm tra
    let packagesToCheck: DisplayPackage[] = [];
    
    if (this.selectedDuration === 'all' && this.groupedPackages.length > 0) {
      // Khi hiển thị theo nhóm, kiểm tra tất cả packages trong các nhóm
      this.groupedPackages.forEach(group => {
        packagesToCheck.push(...group.packages);
      });
    } else {
      // Khi hiển thị bình thường, kiểm tra filteredPackages
      packagesToCheck = this.filteredPackages;
    }
    
    packagesToCheck.forEach(pkg => {
      const element = document.getElementById(`info-list-${pkg.id}`);
      if (element) {
        if (!this.expandedPackages[pkg.id]) {
          // Dùng ngưỡng nhỏ để tránh trường hợp sai số khiến nút expand hiện dù không có nội dung ẩn
          const overflowDelta = element.scrollHeight - element.clientHeight;
          const hasOverflow = overflowDelta > 4;
          this.hasOverflow[pkg.id] = hasOverflow;
          this.needsExpandIcon[pkg.id] = hasOverflow;
        } else {
          this.needsExpandIcon[pkg.id] = this.hasOverflow[pkg.id] || false;
        }
      }
    });
    this.cdr.detectChanges();
  }

  selectPackageType(typeId: string): void {
    this.selectedPackageType = typeId;
    this.loadPackages();
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

    console.log('Applying filters. Total packages:', filtered.length);
    console.log('Selected package type:', this.selectedPackageType);
    console.log('Selected duration:', this.selectedDuration);
    console.log('Search query:', this.searchQuery);

    // Filter by search query - chỉ tìm trong packages của nhà mạng đang chọn
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(pkg => {
        // Tìm kiếm theo tên gói
        const nameMatch = pkg.name?.toLowerCase().includes(query);
        // Tìm kiếm theo mã gói
        const codeMatch = pkg.packageCode?.toLowerCase().includes(query);
        // Tìm kiếm theo thông tin data
        const dataMatch = pkg.dataInfo?.toLowerCase().includes(query);
        // Tìm kiếm theo thông tin call
        const callMatch = pkg.callInfo?.toLowerCase().includes(query);
        // Tìm kiếm theo thông tin SMS
        const smsMatch = pkg.smsInfo?.toLowerCase().includes(query);
        // Tìm kiếm theo specialInfo (cho SPECIAL mode)
        const specialMatch = pkg.specialInfo?.toLowerCase().includes(query);
        // Tìm kiếm theo tiện ích
        const utilitiesMatch = pkg.utilities?.some(u =>
          u.name?.toLowerCase().includes(query)
        );

        return nameMatch || codeMatch || dataMatch || callMatch || smsMatch || specialMatch || utilitiesMatch;
      });
    }

    // Filter by package type - tạm thời bỏ qua vì chưa có dữ liệu packageType từ API
    // filtered = filtered.filter(pkg =>
    //   (pkg.packageType || '4g5g') === this.selectedPackageType
    // );

    // Filter by duration
    if (this.selectedDuration !== 'all') {
      if (this.selectedDuration === '1') {
        filtered = filtered.filter(pkg => pkg.validityDays === 1);
      } else if (this.selectedDuration === '3') {
        filtered = filtered.filter(pkg => pkg.validityDays === 3);
      } else if (this.selectedDuration === '7') {
        filtered = filtered.filter(pkg => pkg.validityDays === 7);
      } else if (this.selectedDuration === '15') {
        filtered = filtered.filter(pkg => pkg.validityDays === 15);
      } else if (this.selectedDuration === '30') {
        // Lọc các gói có thời hạn từ 30-31 ngày
        filtered = filtered.filter(pkg => pkg.validityDays >= 30 && pkg.validityDays <= 31);
      } else if (this.selectedDuration === 'long') {
        // Lọc các gói có thời hạn > 31 ngày
        filtered = filtered.filter(pkg => pkg.validityDays > 31);
      } else if (this.selectedDuration === 'other') {
        // Lọc các gói không có trong các quick filter: không phải 1, 3, 7, 15, 30-31 ngày và không phải > 31 ngày
        filtered = filtered.filter(pkg => {
          const days = pkg.validityDays;
          return days !== 1 && days !== 3 && days !== 7 && days !== 15 && !(days >= 30 && days <= 31) && days <= 31;
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

    console.log('Filtered packages count:', filtered.length);
    
    // Nếu selectedDuration === 'all', nhóm packages theo duration
    if (this.selectedDuration === 'all') {
      this.groupedPackages = this.groupPackagesByDuration(filtered);
      this.filteredPackages = []; // Clear filteredPackages khi hiển thị theo nhóm
    } else {
      this.groupedPackages = [];
      this.filteredPackages = filtered;
    }
    
    this.packageCount = filtered.length;
    this.checkExpandIcons = true;
    setTimeout(() => {
      this.updateExpandIcons();
    }, 100);
  }

  /**
   * Nhóm packages theo duration khi selectedDuration === 'all'
   */
  private groupPackagesByDuration(packages: DisplayPackage[]): PackageGroup[] {
    const groups: PackageGroup[] = [];
    
    // Định nghĩa các nhóm duration
    const durationGroups = [
      { key: '1', label: 'GÓI 1 NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays === 1 },
      { key: '3', label: 'GÓI 3 NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays === 3 },
      { key: '7', label: 'GÓI 7 NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays === 7 },
      { key: '15', label: 'GÓI 15 NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays === 15 },
      { key: '30', label: 'GÓI 30 NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays >= 30 && pkg.validityDays <= 31 },
      { key: 'long', label: 'GÓI DÀI NGÀY', filter: (pkg: DisplayPackage) => pkg.validityDays > 31 },
      { key: 'other', label: 'GÓI KHÁC', filter: (pkg: DisplayPackage) => {
        const days = pkg.validityDays;
        return days !== 1 && days !== 3 && days !== 7 && days !== 15 && !(days >= 30 && days <= 31) && days <= 31;
      }}
    ];

    // Tạo nhóm cho mỗi duration
    durationGroups.forEach(groupDef => {
      const groupPackages = packages.filter(groupDef.filter);
      
      if (groupPackages.length > 0) {
        // Sort by price nếu có selectedPriceSort
        let sortedPackages = [...groupPackages];
        if (this.selectedPriceSort) {
          sortedPackages.sort((a, b) => {
            return this.selectedPriceSort === 'asc'
              ? a.price - b.price
              : b.price - a.price;
          });
        }
        
        // Chỉ lấy tối đa 3 packages đầu tiên để hiển thị
        const displayPackages = sortedPackages.slice(0, 3);
        
        groups.push({
          label: groupDef.label,
          durationKey: groupDef.key,
          packages: displayPackages,
          totalCount: sortedPackages.length
        });
      }
    });

    return groups;
  }

  /**
   * Xử lý khi click "Xem tất cả" của một nhóm
   */
  viewAllPackagesInGroup(durationKey: string): void {
    this.selectedDuration = durationKey;
    this.applyFilters();
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price);
  }

  hasDiscount(pkg: DisplayPackage): boolean {
    return !!(pkg.originalPrice || pkg.discountAmount || pkg.discountPercent);
  }

  getOriginalPrice(pkg: DisplayPackage): number {
    if (pkg.originalPrice) {
      return pkg.originalPrice;
    }
    if (pkg.discountAmount) {
      return pkg.price + pkg.discountAmount;
    }
    if (pkg.discountPercent) {
      return Math.round(pkg.price / (1 - pkg.discountPercent / 100));
    }
    return pkg.price;
  }

  getDiscountDisplay(pkg: DisplayPackage): string {
    if (pkg.discountPercent) {
      return `-${pkg.discountPercent}%`;
    }
    if (pkg.discountAmount) {
      return `-${this.formatPrice(pkg.discountAmount)}₫`;
    }
    if (pkg.originalPrice && pkg.originalPrice > pkg.price) {
      const discount = pkg.originalPrice - pkg.price;
      const percent = Math.round((discount / pkg.originalPrice) * 100);
      return `-${percent}%`;
    }
    return '';
  }

  /**
   * Tính discountPercent từ package để truyền vào payment-method
   */
  getDiscountPercent(pkg: DisplayPackage | null): number {
    if (!pkg) {
      return 0;
    }
    // Ưu tiên discountPercent trực tiếp
    if (pkg.discountPercent) {
      return pkg.discountPercent;
    }
    // Nếu có originalPrice và salePrice, tính từ đó
    if (pkg.originalPrice && pkg.originalPrice > pkg.price) {
      const discount = pkg.originalPrice - pkg.price;
      return Math.round((discount / pkg.originalPrice) * 100);
    }
    // Nếu có discountAmount, tính từ đó
    if (pkg.discountAmount && pkg.originalPrice) {
      return Math.round((pkg.discountAmount / pkg.originalPrice) * 100);
    }
    return 0;
  }

  getSmsDisplayText(smsInfo?: string): string {
    if (!smsInfo) {
      return '';
    }
    // Nếu smsInfo chứa "9999" (có thể là "9999", "9999 SMS", "9999 tin nhắn", etc.)
    if (smsInfo.includes('9999')) {
      return 'Miễn phí SMS nội mạng';
    }
    return smsInfo;
  }

  selectPackage(pkg: DisplayPackage): void {
    console.log('Selected package:', pkg);
    // Thay vì mở payment method, mở modal detail
    this.viewDetails(pkg);
  }

  backToPackages(): void {
    this.showPaymentMethod = false;
    this.selectedPackage = null;
  }

  viewDetails(pkg: DisplayPackage): void {
    console.log('View details for package:', pkg);
    this.detailPackage = pkg;

    // Gọi API để lấy chi tiết package
    this.loading = true;
    this.catalogService.getPackageDetail(pkg.packageCode).subscribe({
      next: (response) => {
        // Convert suggested packages sang DisplayPackage
        this.suggestedPackages = response.suggestedPackages || [];

        // Convert package từ API response (có benefitDetail)
        const detailPackage = this.convertToDisplayPackage(response.package, 0);

        // Lưu package đầy đủ thông tin để hiển thị ưu đãi cho tất cả packages trong family
        this.familyInfoPackage = detailPackage;

        // Tạo familyPackages từ suggested packages + package hiện tại
        // Tìm package tương ứng trong danh sách đã load để lấy thông tin discount đầy đủ
        const familyPackagesList = this.suggestedPackages.map((sp, idx) => {
          // Tìm package tương ứng trong danh sách đã load để lấy discount info
          const existingPackage = this.packages.find(p => p.packageCode === sp.packageCode);
          if (existingPackage) {
            // Nếu tìm thấy, dùng thông tin từ package đã load (có discount)
            return {
              ...this.convertSuggestedToDisplay(sp, idx),
              originalPrice: existingPackage.originalPrice,
              discountPercent: existingPackage.discountPercent,
              discountAmount: existingPackage.discountAmount
            };
          }
          // Nếu không tìm thấy, chỉ dùng thông tin từ suggested
          return this.convertSuggestedToDisplay(sp, idx);
        });

        this.familyPackages = [
          ...familyPackagesList,
          detailPackage
        ].sort((a, b) => a.validityDays - b.validityDays);

        // Nếu không có suggested, chỉ hiển thị package hiện tại
        if (this.familyPackages.length === 0) {
          this.familyPackages = [detailPackage];
        }

        // Tìm package tương ứng với pkg đã chọn để set selectedFamilyPackage
        const selectedPkg = this.familyPackages.find(fp => fp.packageCode === pkg.packageCode) || detailPackage;
        this.selectedFamilyPackage = selectedPkg;
        this.showDetailModal = true;
        document.body.style.overflow = 'hidden';
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading package detail:', err);
        // Fallback: dùng dữ liệu local
        if (pkg.familyId) {
          this.familyPackages = this.packages.filter(
            p => p.familyId === pkg.familyId
          ).sort((a, b) => a.validityDays - b.validityDays);
        } else {
          this.familyPackages = [pkg];
        }
        // Lưu package đầy đủ thông tin để hiển thị ưu đãi
        this.familyInfoPackage = pkg;
        this.selectedFamilyPackage = pkg;
        this.showDetailModal = true;
        document.body.style.overflow = 'hidden';
        this.loading = false;
      }
    });
  }

  /**
   * Convert SuggestedPackageDto sang DisplayPackage
   */
  private convertSuggestedToDisplay(sp: SuggestedPackageDto, index: number): DisplayPackage {
    return {
      packageCode: sp.packageCode,
      displayName: sp.displayName,
      validityDays: sp.validityDays,
      id: this.generateId(sp.packageCode),
      name: sp.displayName,
      price: sp.salePrice,
      duration: `${sp.validityDays} ngày`,
      durationDays: sp.validityDays,
      packageType: this.selectedPackageType,
      color: '#0066CC'
    } as DisplayPackage;
  }

  selectFamilyPackage(pkg: DisplayPackage): void {
    this.selectedFamilyPackage = pkg;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailPackage = null;
    this.familyInfoPackage = null;
    this.familyPackages = [];
    this.selectedFamilyPackage = null;
    this.suggestedPackages = [];
    document.body.style.overflow = 'auto';
  }

  registerFromModal(): void {
    if (this.selectedFamilyPackage) {
      // Lưu package đã chọn trước khi đóng modal (vì closeDetailModal sẽ set selectedFamilyPackage = null)
      const selectedPkg = this.selectedFamilyPackage;
      this.closeDetailModal();
      // Mở payment method trực tiếp từ modal
      this.selectedPackage = selectedPkg;
      this.showPaymentMethod = true;
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  }

  getUtilitiesText(utilities?: Array<{ name: string; iconUrl?: string }>): string {
    if (!utilities || utilities.length === 0) {
      return '';
    }
    return utilities.map(u => u.name).join(', ');
  }

  hasUtilities(pkg: DisplayPackage | null): boolean {
    return !!(pkg?.utilities && pkg.utilities.length > 0);
  }

  getFamilyInfo(): DisplayPackage | null {
    // Trả về familyInfoPackage (package đầy đủ thông tin) để hiển thị ưu đãi
    // Vì tất cả packages trong cùng family có ưu đãi giống nhau
    return this.familyInfoPackage || this.selectedFamilyPackage || (this.familyPackages.length > 0 ? this.familyPackages[0] : null);
  }

  /**
   * Format callInfo cho DetailModal: thay "p" thành " phút"
   */
  formatCallInfoForModal(callInfo?: string): string {
    if (!callInfo) {
      return '';
    }
    // Thay "p" thành " phút" (chỉ thay khi "p" đứng một mình hoặc sau số)
    // Ví dụ: "10p/cuộc" -> "10 phút/cuộc", "500p" -> "500 phút"
    return callInfo.replace(/(\d+)p(\/| |$|\))/g, '$1 phút$2');
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
    setTimeout(() => {
      this.updateExpandIcons();
    }, 300);
  }

  isExpanded(pkgId: number): boolean {
    return !!this.expandedPackages[pkgId];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
