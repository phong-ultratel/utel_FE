import {
  Component,
  OnInit,
  AfterViewInit,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef
} from '@angular/core';
import {CatalogFilters, CatalogService} from '../../services/catalog.service';
import {SearchService} from '../../services/search.service';
import {LookupStateService, LookupStatus} from '../../services/lookup-state.service';
import {PackageCardDto, TelecomProviderCode, CallRaw, PackageFamilyMode} from '../../models/package.model';
import {PackageDetailResponse, SuggestedPackageDto} from '../../models/package-detail.model';
import {Observable, Subject, exhaustMap, finalize, map, take, takeUntil} from 'rxjs';
import {TelcoService, TelcoLookupResponse, TelecomPackageDto} from '../../services/telco.service';

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

interface TelcoLookupRequest {
  msisdn: string;
  sessionId: string;
}

@Component({
  selector: 'app-data-packages',
  templateUrl: './data-packages.component.html',
  styleUrls: ['./data-packages.component.scss']
})
export class DataPackagesComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('recommendedScrollWrap') recommendedScrollWrap?: ElementRef<HTMLElement>;
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
  /** Nhà mạng có trạng thái INACTIVE (Dừng) trên admin — disable nút chọn tương ứng. */
  private disabledProviderCodes = new Set<TelecomProviderCode>();

  selectedPackageType: string = 'all'; // Mặc định là 'all'
  selectedDuration: string = 'all'; // Mặc định hiển thị tất cả
  selectedPriceSort: string | null = 'asc';

  packages: DisplayPackage[] = [];
  private catalogPackages: DisplayPackage[] = [];
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
  /** Gói đề xuất sau tra cứu (tối đa 3), chỉ khi có trong API */
  recommendedPackages: DisplayPackage[] = [];
  /** Gói đề xuất dự phòng (Ưu tiên 1–3) khi chưa tra cứu */
  defaultRecommendedPackages: DisplayPackage[] = [];
  showPaymentMethod: boolean = false;
  selectedPackage: DisplayPackage | null = null;
  paymentSessionId: string = '';
  paymentPhoneNumber: string = '';
  expandedPackages: { [key: number]: boolean } = {};
  needsExpandIcon: { [key: number]: boolean } = {};
  private hasOverflow: { [key: number]: boolean } = {};
  private checkExpandIcons: boolean = true;
  private resizeListener?: () => void;
  private recommendedCarouselObserver?: ResizeObserver;
  private resetRecommendedCarouselScroll = false;
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
  /** Chỉ cho phép 1 request tra cứu đang chạy; request trùng bị exhaustMap bỏ qua. */
  private readonly lookupRequest$ = new Subject<TelcoLookupRequest>();

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
        this.scheduleRecommendedCarouselLayout();
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
    const restoredGroups = this.lookupState.getRestoredGroups();
    if (this.lookupState.currentStatus === 'success' && restored?.length) {
      const providerCode = this.lookupState.getRestoredProviderCode();
      if (providerCode) {
        this.selectedProvider = this.mapProviderCodeToTab(providerCode);
      }
      this.isProviderLocked = true;
      this.lookupDone = true;
      if (restoredGroups) {
        const sampleGroup = [restoredGroups.group1, restoredGroups.group2, restoredGroups.group3, restoredGroups.group4].find(
          g => g.length > 0
        );
        const restoredHasFullDisplay =
          !!sampleGroup && this.isRestoredDisplayShape(sampleGroup as unknown[]);
        if (restoredHasFullDisplay) {
          this.group1Packages = restoredGroups.group1 as DisplayPackage[];
          this.group2Packages = restoredGroups.group2 as DisplayPackage[];
          this.group3Packages = restoredGroups.group3 as DisplayPackage[];
          this.group4Packages = restoredGroups.group4 as DisplayPackage[];
        } else {
          this.group1Packages = (restoredGroups.group1 as TelecomPackageDto[]).map((p, i) =>
            this.convertTelecomPackageToDisplay(p, i));
          this.group2Packages = (restoredGroups.group2 as TelecomPackageDto[]).map((p, i) =>
            this.convertTelecomPackageToDisplay(p, i));
          this.group3Packages = (restoredGroups.group3 as TelecomPackageDto[]).map((p, i) =>
            this.convertTelecomPackageToDisplay(p, i));
          this.group4Packages = (restoredGroups.group4 as TelecomPackageDto[]).map((p, i) =>
            this.convertTelecomPackageToDisplay(p, i));
        }
        this.updatePackagesBySelectedTab();
      } else {
        // Dữ liệu localStorage cũ: chỉ có packages phẳng — tab "Tất cả" + bộ lọc ngày vẫn dùng được
        if (this.isRestoredDisplayShape(restored as unknown[])) {
          this.packages = restored as DisplayPackage[];
        } else {
          this.packages = (restored as TelecomPackageDto[]).map((p, i) => this.convertTelecomPackageToDisplay(p, i));
        }
      }
      const restoredRec = this.lookupState.getRestoredRecommended();
      if (restoredRec?.length) {
        if (this.isRestoredDisplayShape(restoredRec as unknown[])) {
          this.recommendedPackages = restoredRec as DisplayPackage[];
        } else {
          this.recommendedPackages = (restoredRec as TelecomPackageDto[]).map((p, i) =>
            this.convertTelecomPackageToDisplay(p, 100000 + i));
        }
      } else {
        this.recommendedPackages = [];
      }
      this.lookupState.clearRestoredData();
      this.applyFilters();
      this.scheduleRecommendedCarouselLayout(true);
      this.fetchProviderStatuses();
    } else {
      this.lookupDone = false;
      this.loadPackages();
    }

    this.searchService.searchQuery$
      .pipe(takeUntil(this.destroy$))
      .subscribe(query => {
        this.searchQuery = query;
        this.applyFilters();
      });

    this.setupTelcoLookupPipeline();
  }

  /** Một request tra cứu tại một thời điểm — chặn double-click / spam song song. */
  private setupTelcoLookupPipeline(): void {
    this.lookupRequest$
      .pipe(
        exhaustMap(({ msisdn, sessionId }) => {
          this.error = null;
          this.lookupError = null;
          this.recommendedPackages = [];
          return this.telcoService.lookup(msisdn, sessionId).pipe(
            map(resp => ({ resp, msisdn })),
            finalize(() => {
              this.loading = false;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ({ resp, msisdn }) => this.onLookupResponse(resp, msisdn),
        error: err => this.onLookupError(err)
      });
  }

  ngAfterViewInit(): void {
    this.initRecommendedCarouselObserver();
    this.scheduleRecommendedCarouselLayout(true);
  }

  isProviderDisabled(code: TelecomProviderCode): boolean {
    return this.disabledProviderCodes.has(code);
  }

  onProviderChange(provider: TelecomProviderCode): void {
    if (
      this.selectedProvider === provider ||
      this.isProviderLocked ||
      this.isProviderDisabled(provider)
    ) {
      return;
    }
    this.selectedProvider = provider;
    // Clear search khi đổi nhà mạng để hiển thị tất cả gói của nhà mạng mới
    this.searchService.clearSearch();
    this.loadPackages();
  }

  private fetchProviderStatuses(): void {
    this.catalogService
      .getPackages({provider: this.selectedProvider})
      .pipe(take(1))
      .subscribe({
        next: (response) => this.syncProviderStatuses(response.filters),
        error: () => {}
      });
  }

  private syncProviderStatuses(filters?: CatalogFilters): void {
    if (!filters?.providers?.length) {
      return;
    }
    const disabled = new Set<TelecomProviderCode>();
    for (const opt of filters.providers) {
      const code = opt.code?.toUpperCase() as TelecomProviderCode;
      if (opt.status === 'INACTIVE' && this.providers.some(p => p.code === code)) {
        disabled.add(code);
      }
    }
    this.disabledProviderCodes = disabled;
    this.ensureSelectedProviderEnabled();
  }

  private ensureSelectedProviderEnabled(): void {
    if (!this.isProviderDisabled(this.selectedProvider)) {
      return;
    }
    const enabled = this.providers.find(p => !this.isProviderDisabled(p.code));
    if (!enabled) {
      return;
    }
    if (enabled.code === this.selectedProvider) {
      return;
    }
    this.selectedProvider = enabled.code;
    if (!this.lookupDone && !this.isProviderLocked) {
      this.loadPackages();
    }
  }

  loadPackages(): void {
    this.loading = true;
    this.error = null;

    this.catalogService.getPackages({
      provider: this.selectedProvider
      // Không filter familyMode để lấy cả STANDARD và SPECIAL
    }).subscribe({
      next: (response) => {
        this.syncProviderStatuses(response.filters);

        if (!response.packages || response.packages.length === 0) {
          this.error = 'Không có gói cước nào.';
          this.packages = [];
          this.filteredPackages = [];
          this.packageCount = 0;
          this.loading = false;
          return;
        }

        this.packages = response.packages.map((pkg, index) => this.convertToDisplayPackage(pkg, index));
        this.catalogPackages = [...this.packages];
        this.applyFilters();
        this.loading = false;
        if (!this.lookupDone) {
          this.loadDefaultRecommendedPackages();
        } else {
          this.scheduleRecommendedCarouselLayout(true);
        }
      },
      error: (err) => {
        console.error('Error loading packages:', err);
        this.error = 'Không thể tải danh sách gói cước. Vui lòng thử lại sau.';
        this.packages = [];
        this.filteredPackages = [];
        this.packageCount = 0;
        this.defaultRecommendedPackages = [];
        this.loading = false;
      }
    });
  }

  /** Tải gói Ưu tiên 1–3 (cấu hình Import SĐT - Gói KM) cho màn hình chưa tra cứu. */
  private loadDefaultRecommendedPackages(): void {
    this.catalogService.getRecommendedFallback(this.selectedProvider).pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        const pkgs = response.packages || [];
        this.defaultRecommendedPackages = pkgs.map((pkg, index) =>
          this.convertToDisplayPackage(pkg, 9000 + index)
        );
        this.scheduleRecommendedCarouselLayout(true);
      },
      error: () => {
        this.defaultRecommendedPackages = [];
      }
    });
  }

  /** Căn kích thước slide + bật cuộn ngang khi có 3 gói (mobile). */
  private initRecommendedCarouselObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.recommendedCarouselObserver = new ResizeObserver(() => {
      this.updateRecommendedCarouselLayout();
    });
  }

  private scheduleRecommendedCarouselLayout(resetScroll = false): void {
    if (resetScroll) {
      this.resetRecommendedCarouselScroll = true;
    }
    setTimeout(() => {
      this.bindRecommendedCarouselObserver();
      this.updateRecommendedCarouselLayout();
    }, 0);
    setTimeout(() => this.updateRecommendedCarouselLayout(), 200);
  }

  private bindRecommendedCarouselObserver(): void {
    const el = this.recommendedScrollWrap?.nativeElement;
    if (!el || !this.recommendedCarouselObserver) {
      return;
    }
    this.recommendedCarouselObserver.disconnect();
    this.recommendedCarouselObserver.observe(el);
  }

  private updateRecommendedCarouselLayout(): void {
    if (window.innerWidth > 768) {
      return;
    }
    const el = this.recommendedScrollWrap?.nativeElement;
    if (!el) {
      return;
    }

    const count = this.displayRecommendedPackages.length;
    const track = el.querySelector('.recommended-packages-grid') as HTMLElement | null;
    const viewportW = el.clientWidth;

    if (count === 0 || viewportW <= 0) {
      if (track) {
        track.style.width = '';
        track.style.minWidth = '';
      }
      return;
    }

    const slidePx = Math.max(120, Math.floor((viewportW - 10) / 2));
    el.style.setProperty('--recommended-slide-size', `${slidePx}px`);

    if (count > 2 && track) {
      const trackWidth = count * slidePx + (count - 1) * 10;
      track.style.width = `${trackWidth}px`;
      track.style.minWidth = '100%';

      if (this.resetRecommendedCarouselScroll) {
        el.scrollLeft = 0;
        this.resetRecommendedCarouselScroll = false;
      }
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (el.scrollLeft > maxScroll) {
        el.scrollLeft = maxScroll;
      }
    } else if (track) {
      track.style.width = '';
      track.style.minWidth = '';
      el.scrollLeft = 0;
      this.resetRecommendedCarouselScroll = false;
    }
  }

  get hasActiveSearch(): boolean {
    return !!(this.searchQuery && this.searchQuery.trim());
  }

  /** Gói hiển thị trong mục "Đề xuất" (trước / sau tra cứu). */
  get displayRecommendedPackages(): DisplayPackage[] {
    return this.lookupDone ? this.recommendedPackages : this.defaultRecommendedPackages;
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
    // Thay vì mở payment method, mở modal detail
    // Sử dụng requestAnimationFrame để tránh chớp nháy
    requestAnimationFrame(() => {
      this.viewDetails(pkg);
    });
  }

  /**
   * Mobile: bấm vùng ticket trong nhóm Đề xuất → mở modal chi tiết gói.
   */
  onRecommendedTicketLayoutClick(event: Event, pkg: DisplayPackage, fromRecommended?: boolean): void {
    if (!fromRecommended || window.innerWidth > 768) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('.ticket-btn-register, .expand-toggle-btn')) {
      return;
    }
    event.stopPropagation();
    this.selectPackage(pkg);
  }

  backToPackages(): void {
    this.showPaymentMethod = false;
    this.selectedPackage = null;
    this.paymentSessionId = '';
    this.paymentPhoneNumber = '';
  }

  handleLookupExpired(): void {
    this.backToPackages();
    this.resetLookup();
    this.lookupError = 'Phiên tra cứu đã hết hạn. Vui lòng tra cứu lại.';
  }

  viewDetails(pkg: DisplayPackage): void {
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
          const existingPackage = this.findCatalogPackageByCode(sp.packageCode);
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
    if (!this.lookupDone) {
      this.showLookupRequiredMessage();
      this.closeDetailModal();
      return;
    }

    if (this.lookupState.isSessionExpired()) {
      this.closeDetailModal();
      this.handleLookupExpired();
      return;
    }

    if (this.selectedFamilyPackage) {
      // Lưu package đã chọn trước khi đóng modal (vì closeDetailModal sẽ set selectedFamilyPackage = null)
      const selectedPkg = this.selectedFamilyPackage;

      // Đóng modal trước, sau đó mở payment method để tránh chớp nháy
      this.closeDetailModal();

      // Sử dụng setTimeout để đảm bảo modal đã đóng hoàn toàn trước khi mở payment method
      setTimeout(() => {
        this.selectedPackage = selectedPkg;
        this.paymentSessionId = this.lookupState.getOrCreateSessionId();
        this.paymentPhoneNumber = this.resolvePaymentPhoneNumber();
        this.showPaymentMethod = true;
        window.scrollTo({top: 0, behavior: 'smooth'});
      }, 150); // Đợi animation đóng modal hoàn tất (0.3s / 2)
    }
  }

  private resolvePaymentPhoneNumber(): string {
    const directInput = (this.subscriberNumber || '').trim();
    if (directInput) {
      return directInput;
    }

    const lookedUpMsisdn = (this.lookupState.currentLookedUpMsisdn || '').trim();
    if (lookedUpMsisdn) {
      return lookedUpMsisdn;
    }

    return '';
  }

  getUtilitiesText(utilities?: Array<{ name: string; iconUrl?: string }>): string {
    if (!utilities || utilities.length === 0) {
      return '';
    }
    return utilities.map(u => u.name).join(', ');
  }

  /**
   * Format specialInfo: tách các mục sau dấu "- " thành các dòng riêng biệt.
   * Ví dụ: "Ưu đãi: - 1.5GB/1 ngày - Gói cước không tự động gia hạn"
   * → "Ưu đãi: \n- 1.5GB/1 ngày \n- Gói cước không tự động gia hạn"
   */
  formatSpecialInfo(specialInfo?: string): string {
    if (!specialInfo || !specialInfo.trim()) {
      return specialInfo || '';
    }

    // Nếu đã có \n thì có thể đã được format rồi, nhưng vẫn kiểm tra lại
    let text = specialInfo.trim();

    // Tách các phần sau "Ưu đãi:" nếu có
    let prefix = '';
    let content = text;

    if (text.startsWith('Ưu đãi:')) {
      prefix = 'Ưu đãi:';
      content = text.substring('Ưu đãi:'.length).trim();
    }

    // Tách các phần sau dấu "- " thành các dòng riêng
    const parts = content.split(/\s*-\s+/);
    const formatted: string[] = [];

    if (prefix) {
      formatted.push(prefix);
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) {
        continue;
      }

      // Nếu là phần đầu tiên và không có prefix "Ưu đãi:", có thể không có dấu "-"
      if (i === 0 && !prefix && !content.startsWith('-')) {
        formatted.push(part);
      } else {
        formatted.push('- ' + part);
      }
    }

    return formatted.join('\n');
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

  isLookupInProgress(): boolean {
    return this.loading || this.lookupState.currentStatus === 'loading';
  }

  handleLogin(): void {
    if (this.isLookupInProgress()) {
      return;
    }

    const normalized = this.normalizeVietnamPhone(this.subscriberNumber.trim());
    if (!normalized) {
      this.lookupError = 'Số thuê bao không hợp lệ. Vui lòng nhập đúng định dạng';
      return;
    }

    const msisdn = normalized;
    const sessionId = this.lookupState.getOrCreateSessionId();

    this.loading = true;
    this.lookupState.setLoading();
    this.lookupRequest$.next({ msisdn, sessionId });
  }

  private onLookupResponse(resp: TelcoLookupResponse, msisdn: string): void {
    if (!resp?.success) {
      this.error = resp?.message || 'Không thể tra cứu thuê bao. Vui lòng thử lại sau.';
      this.lookupState.setError();
      this.lookupDone = false;
      return;
    }

    const filterByStatus = (pkgs: TelecomPackageDto[]) =>
      (pkgs || []).filter(p => p.status === 'ACTIVE' || p.status === 'PENDING_CONFIG');

    const allRawPackages = filterByStatus(resp.packages || []);
    const group1Raw = filterByStatus(resp.group1 || []);
    const group2Raw = filterByStatus(resp.group2 || []);
    const group3Raw = filterByStatus(resp.group3 || []);
    const group4Raw = filterByStatus(resp.group4 || []);
    const recRaw = filterByStatus(resp.recommendedPackages || []);

    const feProvider = this.mapProviderCodeToTab(resp.providerCode);
    if (resp.providerCode && feProvider !== this.selectedProvider) {
      this.selectedProvider = feProvider;
    }
    this.isProviderLocked = true;
    this.lookupDone = true;
    this.defaultRecommendedPackages = [];

    this.group1Packages = group1Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
    this.group2Packages = group2Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
    this.group3Packages = group3Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));
    this.group4Packages = group4Raw.map((p, index) => this.convertTelecomPackageToDisplay(p, index));

    const flatDisplayForStorage = allRawPackages.map((p, i) => this.convertTelecomPackageToDisplay(p, i));
    const recBase = allRawPackages.length + 1000;
    this.recommendedPackages = recRaw.map((p, i) => this.convertTelecomPackageToDisplay(p, recBase + i));

    this.lookupState.setSuccess(
      msisdn,
      this.formatPhoneForDisplay(msisdn),
      this.getProviderDisplayName(resp.providerCode),
      resp.providerCode,
      flatDisplayForStorage,
      {
        group1: this.group1Packages,
        group2: this.group2Packages,
        group3: this.group3Packages,
        group4: this.group4Packages,
        recommendedPackages: this.recommendedPackages
      }
    );

    this.updatePackagesBySelectedTab();
    this.applyFilters();
    this.scheduleRecommendedCarouselLayout(true);
  }

  private onLookupError(err: unknown): void {
    console.error('Error lookup telco packages:', err);
    this.error = 'Không thể tra cứu thuê bao. Vui lòng thử lại sau.';
    this.lookupState.setError();
    this.lookupDone = false;
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
    this.recommendedPackages = [];
    this.defaultRecommendedPackages = [];
    this.loadPackages();
    this.scrollToLookupInputAndFocus();
  }

  /** Format số điện thoại để hiển thị: 0xx xxx xxx */
  private formatPhoneForDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const nine = digits.slice(-9).padStart(9, '0');
    return '0' + nine.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  private getProviderDisplayName(code: string | undefined): string {
    if (!code) return 'Nhà mạng';
    const tab = this.mapProviderCodeToTab(code);
    const p = this.providers.find(pr => pr.code === tab);
    return p?.name ?? code;
  }

  /** Map mã enum backend (MOBIFONE/VINAPHONE) sang tab FE (MOBI/VINA). */
  private mapProviderCodeToTab(code: string | undefined): TelecomProviderCode {
    if (!code) {
      return this.selectedProvider;
    }
    if (code === 'MOBIFONE') {
      return 'MOBI';
    }
    if (code === 'VINAPHONE') {
      return 'VINA';
    }
    return code as TelecomProviderCode;
  }

  /** Dữ liệu tra cứu đã lưu dạng DisplayPackage (có name, price) sau khi merge catalog — khác payload TelecomPackageDto thuần. */
  private isRestoredDisplayShape(items: unknown[]): boolean {
    if (!items?.length) {
      return false;
    }
    const x = items[0] as any;
    return (
      typeof x?.packageCode === 'string' &&
      typeof x?.price === 'number' &&
      typeof x?.name === 'string'
    );
  }

  private convertTelecomPackageToDisplay(pkg: TelecomPackageDto, index: number): DisplayPackage {
    const validityDays = pkg.validityDays || 1;
    const lookupPkg = pkg as any;
    const matchedCatalogPkg = this.findCatalogPackageByCode(pkg.packageCode);

    // Nếu gói đã có sẵn trong DB/catalog thì giữ nguyên cách hiển thị như trước tra cứu.
    if (matchedCatalogPkg) {
      const normalizedValidityDays = matchedCatalogPkg.validityDays || validityDays;
      return {
        ...matchedCatalogPkg,
        packageCode: pkg.packageCode,
        displayName: matchedCatalogPkg.displayName || pkg.displayName,
        name: matchedCatalogPkg.name || pkg.displayName,
        validityDays: normalizedValidityDays,
        durationDays: normalizedValidityDays,
        duration: `${normalizedValidityDays} ngày`,
        familyId: pkg.family?.code || matchedCatalogPkg.familyId
      };
    }

    // Lookup payload thường chỉ có originalPrice; nếu có thêm salePrice/discount thì ưu tiên dùng.
    // Nếu thiếu, fallback sang dữ liệu catalog hiện có để không mất badge khuyến mại sau "Tra cứu".
    const salePrice =
      (typeof lookupPkg.salePrice === 'number' ? lookupPkg.salePrice : undefined) ??
      pkg.originalPrice ??
      0;

    const originalPrice =
      (typeof lookupPkg.originalPrice === 'number' ? lookupPkg.originalPrice : undefined) ??
      salePrice;

    const discountPercent =
      (typeof lookupPkg.discountPercent === 'number' ? lookupPkg.discountPercent : undefined);

    const discountAmount =
      (typeof lookupPkg.discountAmount === 'number' ? lookupPkg.discountAmount : undefined) ??
      (typeof lookupPkg.discountValue === 'number' ? lookupPkg.discountValue : undefined);

    const discountText =
      (typeof lookupPkg.discountText === 'string' ? lookupPkg.discountText : undefined);

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
        originalPrice,
        salePrice,
        discountPercent,
        discountValue: discountAmount,
        discountText
      },
      raw: {}
    };

    const display = this.convertToDisplayPackage(cardDto, index);

    // Luôn gán specialInfo để block "Special Info" và info-value hiển thị (kể cả khi API không trả family)
    display.specialInfo = specialInfoText;
    display.familyId = pkg.family?.code || display.familyId;

    return display;
  }

  private findCatalogPackageByCode(packageCode: string): DisplayPackage | undefined {
    if (!packageCode) {
      return undefined;
    }
    const lists: DisplayPackage[][] = [
      this.catalogPackages,
      this.packages,
      this.group1Packages,
      this.group2Packages,
      this.group3Packages,
      this.group4Packages,
      this.recommendedPackages,
      this.defaultRecommendedPackages
    ];
    for (const list of lists) {
      const found = list?.find(p => p.packageCode === packageCode);
      if (found) {
        return found;
      }
    }
    return undefined;
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

  onSubscriberInput(): void {
    if (this.lookupError === 'Hãy nhập số điện thoại để tra cứu gói cước') {
      this.lookupError = null;
    }
  }

  private showLookupRequiredMessage(): void {
    this.lookupError = 'Hãy nhập số điện thoại để tra cứu gói cước phù hợp.';
    setTimeout(() => {
      document.getElementById('lookup-section')?.scrollIntoView({behavior: 'smooth', block: 'center'});
      setTimeout(() => (document.getElementById('lookup-input') as HTMLInputElement)?.focus(), 250);
    }, 50);
  }

  /**
   * Cuộn đến ô nhập số thuê bao và focus — gọi sau khi đảm bảo view đã render input
   * (sau reset tra cứu).
   */
  private scrollToLookupInputAndFocus(): void {
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = document.getElementById('lookup-input') as HTMLInputElement | null;
        if (input) {
          input.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
          setTimeout(() => input.focus({preventScroll: true}), 450);
        } else {
          document.getElementById('lookup-section')?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.recommendedCarouselObserver?.disconnect();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
