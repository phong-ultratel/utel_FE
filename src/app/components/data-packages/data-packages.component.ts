import { Component, OnInit, AfterViewChecked, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CatalogService } from '../../services/catalog.service';
import { PackageCardDto, TelecomProviderCode, CallRaw } from '../../models/package.model';
import { PackageDetailResponse, SuggestedPackageDto } from '../../models/package-detail.model';

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
    { id: '4g5g', label: 'Gói cước 4G/5G' },
    { id: '5g', label: 'Gói cước 5G' },
    { id: 'hot', label: 'Gói cước Hot' },
    { id: 'dcom', label: 'Gói cước Dcom' },
    { id: 'roaming', label: 'Gói Roaming' }
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
  loading: boolean = false;
  error: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private catalogService: CatalogService
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
  }

  onProviderChange(provider: TelecomProviderCode): void {
    if (this.selectedProvider === provider || this.isProviderLocked) {
      return;
    }
    this.selectedProvider = provider;
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading = true;
    this.error = null;

    this.catalogService.getPackages({
      provider: this.selectedProvider,
      familyMode: 'STANDARD' // Chỉ lấy STANDARD mode
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
    const pricing = pkg.pricing || { originalPrice: 0, salePrice: 0 };
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
    
    // Debug: log để kiểm tra
    if (pkg.packageCode === 'VT_MP15K' || pkg.packageCode.includes('MP15K')) {
      console.log('Package:', pkg.packageCode, {
        callText: display.callText,
        rawCall: raw?.call,
        finalCallInfo: callInfo
      });
    }

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
    const utilityNames = ['TV360', 'TIKTOK', 'YOUTUBE', 'FACEBOOK'];
    const found: Array<{ name: string; iconUrl?: string }> = [];

    utilityNames.forEach(name => {
      if (benefitText.toUpperCase().includes(name)) {
        found.push({ name });
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
    this.filteredPackages.forEach(pkg => {
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

    // Filter by package type - tạm thời bỏ qua vì chưa có dữ liệu packageType từ API
    // filtered = filtered.filter(pkg => 
    //   (pkg.packageType || '4g5g') === this.selectedPackageType
    // );

    // Filter by duration
    if (this.selectedDuration !== 'all') {
      if (this.selectedDuration === '30') {
        filtered = filtered.filter(pkg => pkg.validityDays === 30);
      } else if (this.selectedDuration === '1') {
        filtered = filtered.filter(pkg => pkg.validityDays === 1);
      } else if (this.selectedDuration === '7') {
        filtered = filtered.filter(pkg => pkg.validityDays === 7);
      } else if (this.selectedDuration === 'long') {
        filtered = filtered.filter(pkg => pkg.validityDays > 30);
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
    this.filteredPackages = filtered;
    this.packageCount = filtered.length;
    this.checkExpandIcons = true;
    setTimeout(() => {
      this.updateExpandIcons();
    }, 100);
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
    this.selectedPackage = pkg;
    this.showPaymentMethod = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        // Tạo familyPackages từ suggested packages + package hiện tại
        this.familyPackages = [
          ...this.suggestedPackages.map((sp, idx) => this.convertSuggestedToDisplay(sp, idx)),
          this.convertToDisplayPackage(response.package, 0)
        ].sort((a, b) => a.validityDays - b.validityDays);

        // Nếu không có suggested, chỉ hiển thị package hiện tại
        if (this.familyPackages.length === 0) {
          this.familyPackages = [pkg];
        }

        this.selectedFamilyPackage = pkg;
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
    this.familyPackages = [];
    this.selectedFamilyPackage = null;
    this.suggestedPackages = [];
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

  hasUtilities(pkg: DisplayPackage | null): boolean {
    return !!(pkg?.utilities && pkg.utilities.length > 0);
  }

  getFamilyInfo(): DisplayPackage | null {
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
    setTimeout(() => {
      this.updateExpandIcons();
    }, 300);
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
