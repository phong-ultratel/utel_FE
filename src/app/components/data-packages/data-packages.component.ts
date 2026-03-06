import {Component, OnInit, AfterViewChecked, OnDestroy, ChangeDetectorRef} from '@angular/core';
import {CatalogService} from '../../services/catalog.service';
import {SearchService} from '../../services/search.service';
import {LookupStateService, LookupStatus} from '../../services/lookup-state.service';
import {PackageCardDto, TelecomProviderCode, CallRaw, PackageFamilyMode} from '../../models/package.model';
import {PackageDetailResponse, SuggestedPackageDto} from '../../models/package-detail.model';
import {Observable, Subject, takeUntil, pairwise, startWith} from 'rxjs';
import {TelcoService, TelecomPackageDto} from '../../services/telco.service';

// Interface tương thích với template hiện tại
interface DisplayPackage extends PackageCardDto {
  id: number; // Dùng index hoặc hash của packageCode
  name: string; // Alias cho displayName
  price: number; // Alias cho pricing.salePrice
  originalPrice?: number; // Alias cho pricing.originalPrice
  discountPercent?: number; // Tính từ pricing
  discountAmount?: number; // Tính từ pricing
  discountText?: string; // Text hiển thị từ pricing hoặc tự format
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
    {id: 'all', label: 'TẤT CẢ'},
    {id: 'combo', label: 'GÓI COMBO/ MXH'},
    {id: 'data', label: 'GÓI DATA'},
    // {id: 'hot', label: 'Gói cước Hot'},
    // {id: 'dcom', label: 'Gói cước Dcom'},
    {id: 'roaming', label: 'GÓI ROAMING'}
  ];

  selectedProvider: TelecomProviderCode = 'VIETTEL';
  // Chuẩn bị sẵn cấu trúc để khóa nhà mạng sau khi tra cứu thuê bao (logic sẽ bổ sung sau)
  isProviderLocked: boolean = false;

  selectedPackageType: string = 'all'; // Mặc định là 'all'
  selectedDuration: string = 'all'; // Mặc định hiển thị tất cả
  selectedPriceSort: string | null = 'asc';

  packages: DisplayPackage[] = [];
  filteredPackages: DisplayPackage[] = [];
  packageCount: number = 0;
  groupedPackages: PackageGroup[] = [];
  subscriberNumber: string = '';
  lookupError: string | null = null;
  lookupDone: boolean = false; // Trạng thái đã tra cứu hay chưa

  // Packages theo từng group
  group1Packages: DisplayPackage[] = [];
  group2Packages: DisplayPackage[] = [];
  group3Packages: DisplayPackage[] = [];
  group4Packages: DisplayPackage[] = [];
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
  isSearchFocused: boolean = false;
  private destroy$ = new Subject<void>();

  lookupStatus$!: Observable<LookupStatus>;
  lookedUpPhoneDisplay$!: Observable<string | null>;
  lookedUpProviderName$!: Observable<string | null>;

  constructor(
    private cdr: ChangeDetectorRef,
    private catalogService: CatalogService,
    private searchService: SearchService,
    private telcoService: TelcoService,
    private lookupState: LookupStateService
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
    this.lookupStatus$ = this.lookupState.getStatus();
    this.lookedUpPhoneDisplay$ = this.lookupState.getLookedUpPhoneDisplay();
    this.lookedUpProviderName$ = this.lookupState.getLookedUpProviderName();

    // Restore trạng thái tra cứu sau khi refresh
    const restored = this.lookupState.getRestoredPackages();
    if (this.lookupState.currentStatus === 'success' && restored?.length) {
      const providerCode = this.lookupState.getRestoredProviderCode();
      if (providerCode) {
        this.selectedProvider = providerCode as TelecomProviderCode;
      }
      this.isProviderLocked = true;
      this.lookupDone = true;
      // Note: Khi restore, không có thông tin về group, nên chỉ restore packages tổng hợp
      this.packages = (restored as TelecomPackageDto[]).map((p, i) => this.convertTelecomPackageToDisplay(p, i));
      this.lookupState.clearRestoredData();
      this.applyFilters();
    } else {
      this.lookupDone = false;
      this.loadPackages();
    }

    // Khi reset từ success -> idle: scroll về lookup và focus input
    this.lookupState
      .getStatus()
      .pipe(
        startWith(this.lookupState.currentStatus),
        pairwise(),
        takeUntil(this.destroy$)
      )
      .subscribe(([prev, curr]) => {
        if (prev === 'success' && curr === 'idle') {
          setTimeout(() => {
            document.getElementById('lookup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => (document.getElementById('lookup-input') as HTMLInputElement)?.focus(), 300);
          }, 50);
        }
      });

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

    // Tính discount: ưu tiên dùng thông tin từ API (pricing.discountPercent / discountValue / discountText)
    let discountPercent: number | undefined = pricing.discountPercent;
    let discountAmount: number | undefined = pricing.discountValue;
    const discountText: string | undefined = pricing.discountText;

    // Nếu API không trả discount nhưng có originalPrice > salePrice thì tự tính
    if (
      (!discountPercent && !discountAmount) &&
      pricing.originalPrice &&
      pricing.salePrice &&
      pricing.originalPrice > pricing.salePrice
    ) {
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
      discountText,
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
    if (!this.lookupDone && typeId !== 'all') {
      // Chỉ cho phép chọn tab "Tất cả" khi chưa tra cứu
      return;
    }
    this.selectedPackageType = typeId;
    if (this.lookupDone) {
      // Nếu đã tra cứu, cập nhật packages theo tab
      this.updatePackagesBySelectedTab();
      this.applyFilters();
    } else {
      // Nếu chưa tra cứu, load packages từ catalog
      this.loadPackages();
    }
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
    return !!(pkg.originalPrice || pkg.discountAmount || pkg.discountPercent || pkg.discountText);
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
    // Ưu tiên dùng discountText từ API (đã được format theo logic Pricing Rule)
    if (pkg.discountText) {
      return pkg.discountText;
    }

    // Nếu có phần trăm giảm giá -> hiển thị dạng "-20%"
    if (pkg.discountPercent) {
      return `-${pkg.discountPercent}%`;
    }

    // Nếu có số tiền giảm cố định -> hiển thị dạng "(-20.000đ)"
    if (pkg.discountAmount) {
      return `(-${this.formatPrice(pkg.discountAmount)}đ)`;
    }

    // Fallback: tự tính từ originalPrice và price nếu có
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
    // Sử dụng requestAnimationFrame để tránh chớp nháy
    requestAnimationFrame(() => {
      this.viewDetails(pkg);
    });
  }

  backToPackages(): void {
    this.showPaymentMethod = false;
    this.selectedPackage = null;
  }

  viewDetails(pkg: DisplayPackage): void {
    console.log('View details for package:', pkg);
    this.detailPackage = pkg;

    // Hiển thị modal ngay với dữ liệu local để tránh chớp nháy
    // Fallback: dùng dữ liệu local trước
    if (pkg.familyId) {
      this.familyPackages = this.packages.filter(
        p => p.familyId === pkg.familyId
      ).sort((a, b) => a.validityDays - b.validityDays);
    } else {
      this.familyPackages = [pkg];
    }
    this.familyInfoPackage = pkg;
    this.selectedFamilyPackage = pkg;

    // Sử dụng requestAnimationFrame để đảm bảo DOM đã sẵn sàng trước khi hiển thị modal
    requestAnimationFrame(() => {
      this.showDetailModal = true;
      document.body.style.overflow = 'hidden';
    });

    // Gọi API để lấy chi tiết package (không set loading để tránh chớp nháy)
    this.catalogService.getPackageDetail(pkg.packageCode).subscribe({
      next: (response) => {
        // Convert suggested packages sang DisplayPackage
        this.suggestedPackages = response.suggestedPackages || [];

        // Convert package từ API response (có benefitDetail)
        const detailPackage = this.convertToDisplayPackage(response.package, 0);

        // Merge discount info từ package gốc vào detailPackage (nếu có)
        if (pkg.originalPrice || pkg.discountPercent || pkg.discountAmount) {
          detailPackage.originalPrice = pkg.originalPrice || detailPackage.originalPrice;
          detailPackage.discountPercent = pkg.discountPercent || detailPackage.discountPercent;
          detailPackage.discountAmount = pkg.discountAmount || detailPackage.discountAmount;
        }

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
              discountAmount: existingPackage.discountAmount,
              discountText: existingPackage.discountText
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
        // Merge discount info từ package gốc nếu selectedPkg không có
        const selectedPkg = this.familyPackages.find(fp => fp.packageCode === pkg.packageCode) || detailPackage;
        if (!selectedPkg.originalPrice && !selectedPkg.discountPercent && !selectedPkg.discountAmount) {
          if (pkg.originalPrice || pkg.discountPercent || pkg.discountAmount) {
            selectedPkg.originalPrice = pkg.originalPrice;
            selectedPkg.discountPercent = pkg.discountPercent;
            selectedPkg.discountAmount = pkg.discountAmount;
          }
        }
        this.selectedFamilyPackage = selectedPkg;
      },
      error: (err) => {
        console.error('Error loading package detail:', err);
        // Giữ nguyên dữ liệu local đã hiển thị
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

      // Đóng modal trước, sau đó mở payment method để tránh chớp nháy
      this.closeDetailModal();

      // Sử dụng setTimeout để đảm bảo modal đã đóng hoàn toàn trước khi mở payment method
      setTimeout(() => {
        this.selectedPackage = selectedPkg;
        this.showPaymentMethod = true;
        window.scrollTo({top: 0, behavior: 'smooth'});
      }, 150); // Đợi animation đóng modal hoàn tất (0.3s / 2)
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
   * Lấy package có discount info đầy đủ cho modal
   * Ưu tiên tìm trong danh sách packages đã load (có discount info)
   */
  getModalPackage(): DisplayPackage | null {
    if (!this.selectedFamilyPackage) {
      return null;
    }

    // Tìm package trong danh sách đã load để lấy discount info đầy đủ
    const packageWithDiscount = this.packages.find(
      p => p.packageCode === this.selectedFamilyPackage?.packageCode
    );

    // Nếu tìm thấy package có discount info, dùng nó
    if (packageWithDiscount && this.hasDiscount(packageWithDiscount)) {
      return packageWithDiscount;
    }

    // Nếu không, dùng selectedFamilyPackage (có thể có hoặc không có discount)
    return this.selectedFamilyPackage;
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

  /**
   * Chuẩn hóa và validate số điện thoại di động Việt Nam.
   * Trả về msisdn dạng 84xxxxxxxxx nếu hợp lệ, ngược lại trả về null.
   * Các dạng hỗ trợ (ví dụ 0966818787):
   *  - 84966818787
   *  - +84966818787
   *  - 0966818787
   *  - 966818787
   */
  private normalizeVietnamPhone(input: string): string | null {
    if (!input) {
      return null;
    }

    // Loại bỏ khoảng trắng, dấu chấm, gạch ngang...
    let raw = input.replace(/[\s\.\-]/g, '');

    // Bỏ dấu +
    if (raw.startsWith('+')) {
      raw = raw.substring(1);
    }

    // Chỉ chấp nhận chữ số
    if (!/^\d+$/.test(raw)) {
      return null;
    }

    let digits = raw;

    // 84xxxxxxxxx (11 số, bắt đầu bằng 84)
    if (digits.length === 11 && digits.startsWith('84')) {
      // giữ nguyên
    }
    // 0xxxxxxxxx (10 số, bắt đầu bằng 0) -> 84xxxxxxxxx
    else if (digits.length === 10 && digits.startsWith('0')) {
      digits = '84' + digits.substring(1);
    }
    // xxxxxxxxx (9 số, thiếu số 0 đầu) -> 84xxxxxxxxx
    else if (digits.length === 9) {
      digits = '84' + digits;
    } else {
      return null;
    }

    // Validate lại prefix di động Việt Nam: 0[3|5|7|8|9]xxxxxxxx
    const localForm = '0' + digits.substring(2); // chuyển 84xxxxxxxxx -> 0xxxxxxxxx
    if (!/^0(3|5|7|8|9)\d{8}$/.test(localForm)) {
      return null;
    }

    return digits;
  }

  handleLogin(): void {
    const normalized = this.normalizeVietnamPhone(this.subscriberNumber.trim());
    if (!normalized) {
      this.lookupError = 'Số thuê bao không hợp lệ. Vui lòng nhập đúng định dạng';
      return;
    }

    const msisdn = normalized;

    this.loading = true;
    this.error = null;
    this.lookupError = null;
    this.lookupState.setLoading();

    this.telcoService.lookup(msisdn).pipe(takeUntil(this.destroy$)).subscribe({
      next: resp => {
        this.loading = false;

        if (!resp?.success) {
          this.error = resp?.message || 'Không thể tra cứu thuê bao. Vui lòng thử lại sau.';
          this.lookupState.setError();
          this.lookupDone = false;
          return;
        }

        // Lọc packages theo status
        const filterByStatus = (pkgs: TelecomPackageDto[]) => 
          (pkgs || []).filter(p => p.status === 'ACTIVE' || p.status === 'PENDING_CONFIG');

        const allRawPackages = filterByStatus(resp.packages || []);
        const group1Raw = filterByStatus(resp.group1 || []);
        const group2Raw = filterByStatus(resp.group2 || []);
        const group3Raw = filterByStatus(resp.group3 || []);
        const group4Raw = filterByStatus(resp.group4 || []);

        this.lookupState.setSuccess(
          this.formatPhoneForDisplay(msisdn),
          this.getProviderDisplayName(resp.providerCode),
          resp.providerCode,
          allRawPackages
        );

        if (resp.providerCode && resp.providerCode !== this.selectedProvider) {
          this.selectedProvider = resp.providerCode as TelecomProviderCode;
        }
        this.isProviderLocked = true;
        this.lookupDone = true;

        // Convert và lưu packages theo từng group
        this.group1Packages = group1Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
        this.group2Packages = group2Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
        this.group3Packages = group3Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
        this.group4Packages = group4Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));

        // Set packages theo tab hiện tại
        this.updatePackagesBySelectedTab();
        this.applyFilters();
      },
      error: err => {
        console.error('Error lookup telco packages:', err);
        this.loading = false;
        this.error = 'Không thể tra cứu thuê bao. Vui lòng thử lại sau.';
        this.lookupState.setError();
        this.lookupDone = false;
      }
    });
  }

  /**
   * Cập nhật packages theo tab đã chọn
   */
  private updatePackagesBySelectedTab(): void {
    switch (this.selectedPackageType) {
      case 'all':
        // Tất cả = group1 + group2 + group3 + group4
        this.packages = [
          ...this.group1Packages,
          ...this.group2Packages,
          ...this.group3Packages,
          ...this.group4Packages
        ];
        break;
      case 'combo':
        // Combo/MXH = group3
        this.packages = [...this.group3Packages];
        break;
      case 'data':
        // Data = group1 + group4
        this.packages = [...this.group1Packages, ...this.group4Packages];
        break;
      case 'roaming':
        // Roaming = group2
        this.packages = [...this.group2Packages];
        break;
      default:
        this.packages = [];
    }
  }

  /** Reset lookup: về idle, xóa số, load lại catalog, scroll + focus input */
  resetLookup(): void {
    this.lookupState.reset();
    this.subscriberNumber = '';
    this.isProviderLocked = false;
    this.error = null;
    this.lookupError = null;
    this.lookupDone = false;
    this.selectedPackageType = 'all'; // Reset về tab "Tất cả"
    this.group1Packages = [];
    this.group2Packages = [];
    this.group3Packages = [];
    this.group4Packages = [];
    this.loadPackages();
  }

  /** Format số điện thoại để hiển thị: 0xx xxx xxx */
  private formatPhoneForDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const nine = digits.slice(-9).padStart(9, '0');
    return '0' + nine.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  private getProviderDisplayName(code: string | undefined): string {
    if (!code) return 'Nhà mạng';
    const p = this.providers.find(pr => pr.code === code);
    return p?.name ?? code;
  }

  private convertTelecomPackageToDisplay(pkg: TelecomPackageDto, index: number): DisplayPackage {
    const validityDays = pkg.validityDays || 1;
    const price = pkg.originalPrice || 0;

    // Ưu đãi/mô tả: ưu tiên specialInfo, benefitDetail; luôn có fallback để package-info-list có ít nhất một info-value
    const specialInfoText =
      (pkg.family?.specialInfo && pkg.family.specialInfo.trim()) ||
      (pkg.family?.benefitDetail && pkg.family.benefitDetail.trim()) ||
      `Gói ${pkg.displayName || pkg.packageCode}`;

    const cardDto: PackageCardDto = {
      packageCode: pkg.packageCode,
      displayName: pkg.displayName,
      validityDays: validityDays,
      familyMode: (pkg.family?.packageFamilyMode as PackageFamilyMode) || 'SPECIAL',
      display: {
        specialInfo: specialInfoText,
        dataText: (pkg.family as any)?.description?.trim() || undefined,
        callText: undefined,
        smsText: undefined,
        benefitText: undefined
      },
      pricing: {
        originalPrice: price,
        salePrice: price
      },
      raw: {}
    };

    const display = this.convertToDisplayPackage(cardDto, index);

    // Luôn gán specialInfo để block "Special Info" và info-value hiển thị (kể cả khi API không trả family)
    display.specialInfo = specialInfoText;
    display.familyId = pkg.family?.code || display.familyId;

    return display;
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

  onSearch(): void {
    // Cập nhật search query vào service
    this.searchService.setSearchQuery(this.searchQuery.trim());
  }

  onSearchInput(): void {
    // Tìm kiếm real-time khi người dùng nhập
    this.searchService.setSearchQuery(this.searchQuery.trim());
  }

  onSearchFocus(): void {
    this.isSearchFocused = true;
  }

  onSearchBlur(): void {
    this.isSearchFocused = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
