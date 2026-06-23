import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AttributionService } from './attribution.service';

export type LookupStatus = 'idle' | 'loading' | 'success' | 'error';

const STORAGE_KEY = 'utel_lookup_state';

/** Phiên tra cứu hợp lệ 30 phút — khớp LOOKUP_MAX_AGE trên backend */
export const LOOKUP_SESSION_TTL_MS = 30 * 60 * 1000;

export interface PersistedLookupState {
  status: LookupStatus;
  phoneDisplay: string;
  msisdn?: string;
  providerName: string;
  providerCode: string;
  packages: unknown[];
  /** Phân nhóm từ API tra cứu — cần để đổi tab loại gói sau khi F5 / quay lại trang */
  group1?: unknown[];
  group2?: unknown[];
  group3?: unknown[];
  group4?: unknown[];
  /** Gói đề xuất sau tra cứu (đã merge hiển thị) */
  recommendedPackages?: unknown[];
  /** Unix timestamp (ms) lúc lưu — dùng để hết hạn sau LOOKUP_SESSION_TTL_MS */
  savedAt?: number;
}

export function isLookupExpiredHttpError(err: unknown): boolean {
  const body = (err as { error?: Record<string, unknown> })?.error;
  if (!body) {
    return false;
  }
  if (body['errorKey'] === 'lookupexpired') {
    return true;
  }
  return body['message'] === 'error.lookupexpired';
}

@Injectable({
  providedIn: 'root'
})
export class LookupStateService {
  private readonly status$ = new BehaviorSubject<LookupStatus>('idle');
  private readonly lookedUpPhoneDisplay$ = new BehaviorSubject<string | null>(null);
  private readonly lookedUpMsisdn$ = new BehaviorSubject<string | null>(null);
  private readonly lookedUpProviderName$ = new BehaviorSubject<string | null>(null);
  private restoredPackages: unknown[] | null = null;
  private restoredProviderCode: string | null = null;
  private restoredGroup1: unknown[] | null = null;
  private restoredGroup2: unknown[] | null = null;
  private restoredGroup3: unknown[] | null = null;
  private restoredGroup4: unknown[] | null = null;
  private restoredRecommended: unknown[] | null = null;
  private lookupSavedAt: number | null = null;

  constructor(private attributionService: AttributionService) {
    this.loadFromStorage();
  }

  /**
   * Session thống nhất với visit tracking (AttributionService).
   */
  getOrCreateSessionId(): string {
    return this.attributionService.getOrCreateVisitorSessionId();
  }

  private isPersistedStateExpired(state: PersistedLookupState): boolean {
    if (typeof state.savedAt !== 'number' || !Number.isFinite(state.savedAt)) {
      return true;
    }
    return Date.now() - state.savedAt > LOOKUP_SESSION_TTL_MS;
  }

  /** true khi đang ở trạng thái tra cứu thành công nhưng đã quá LOOKUP_SESSION_TTL_MS */
  isSessionExpired(): boolean {
    if (this.status$.value !== 'success') {
      return false;
    }
    if (this.lookupSavedAt == null || !Number.isFinite(this.lookupSavedAt)) {
      return true;
    }
    return Date.now() - this.lookupSavedAt > LOOKUP_SESSION_TTL_MS;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: PersistedLookupState = JSON.parse(raw);
      if (state.status !== 'success' || !state.phoneDisplay) return;
      if (this.isPersistedStateExpired(state)) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.status$.next('success');
      this.lookedUpPhoneDisplay$.next(state.phoneDisplay);
      this.lookedUpMsisdn$.next(state.msisdn ?? null);
      this.lookedUpProviderName$.next(state.providerName ?? null);
      this.restoredPackages = Array.isArray(state.packages) ? state.packages : null;
      this.restoredProviderCode = state.providerCode ?? null;
      const hasGroupFields = 'group1' in state;
      if (hasGroupFields) {
        this.restoredGroup1 = Array.isArray(state.group1) ? state.group1 : [];
        this.restoredGroup2 = Array.isArray(state.group2) ? state.group2 : [];
        this.restoredGroup3 = Array.isArray(state.group3) ? state.group3 : [];
        this.restoredGroup4 = Array.isArray(state.group4) ? state.group4 : [];
      } else {
        this.restoredGroup1 = null;
        this.restoredGroup2 = null;
        this.restoredGroup3 = null;
        this.restoredGroup4 = null;
      }
      this.restoredRecommended = Array.isArray(state.recommendedPackages) ? state.recommendedPackages : null;
      this.lookupSavedAt = typeof state.savedAt === 'number' ? state.savedAt : null;
    } catch {
      // ignore invalid stored data
    }
  }

  private saveToStorage(state: PersistedLookupState | null): void {
    try {
      if (state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore quota / storage errors
    }
  }

  getStatus(): Observable<LookupStatus> {
    return this.status$.asObservable();
  }

  getLookedUpPhoneDisplay(): Observable<string | null> {
    return this.lookedUpPhoneDisplay$.asObservable();
  }

  getLookedUpMsisdn(): Observable<string | null> {
    return this.lookedUpMsisdn$.asObservable();
  }

  get currentLookedUpMsisdn(): string | null {
    return this.lookedUpMsisdn$.value;
  }

  getLookedUpProviderName(): Observable<string | null> {
    return this.lookedUpProviderName$.asObservable();
  }

  get currentStatus(): LookupStatus {
    return this.status$.value;
  }

  /** Gói đã lưu khi refresh (chỉ có khi vừa load từ localStorage). */
  getRestoredPackages(): unknown[] | null {
    return this.restoredPackages;
  }

  /** Mã nhà mạng đã lưu (VIETTEL, MOBI, VINA) để restore selectedProvider. */
  getRestoredProviderCode(): string | null {
    return this.restoredProviderCode;
  }

  /** Gọi sau khi đã dùng restored packages để tránh dùng lại lần sau. */
  clearRestoredData(): void {
    this.restoredPackages = null;
    this.restoredProviderCode = null;
    this.restoredGroup1 = null;
    this.restoredGroup2 = null;
    this.restoredGroup3 = null;
    this.restoredGroup4 = null;
    this.restoredRecommended = null;
  }

  /**
   * Các nhóm gói đã lưu (sau F5). null nếu dữ liệu cũ trong localStorage chưa có group*.
   * Khi null, component có thể chỉ khôi phục đúng tab "Tất cả" từ packages phẳng.
   */
  /** Gói đề xuất đã lưu (sau F5). */
  getRestoredRecommended(): unknown[] | null {
    return this.restoredRecommended;
  }

  getRestoredGroups():
    | { group1: unknown[]; group2: unknown[]; group3: unknown[]; group4: unknown[] }
    | null {
    if (
      this.restoredGroup1 === null &&
      this.restoredGroup2 === null &&
      this.restoredGroup3 === null &&
      this.restoredGroup4 === null
    ) {
      return null;
    }
    return {
      group1: this.restoredGroup1 ?? [],
      group2: this.restoredGroup2 ?? [],
      group3: this.restoredGroup3 ?? [],
      group4: this.restoredGroup4 ?? []
    };
  }

  setLoading(): void {
    this.status$.next('loading');
  }

  setSuccess(
    msisdn: string,
    phoneDisplay: string,
    providerName: string,
    providerCode?: string,
    packages?: unknown[],
    groups?: {
      group1?: unknown[];
      group2?: unknown[];
      group3?: unknown[];
      group4?: unknown[];
      recommendedPackages?: unknown[];
    }
  ): void {
    this.status$.next('success');
    this.lookedUpPhoneDisplay$.next(phoneDisplay);
    this.lookedUpMsisdn$.next(msisdn);
    this.lookedUpProviderName$.next(providerName);
    this.restoredPackages = null;
    this.restoredProviderCode = null;
    this.restoredGroup1 = null;
    this.restoredGroup2 = null;
    this.restoredGroup3 = null;
    this.restoredGroup4 = null;
    this.restoredRecommended = null;
    this.lookupSavedAt = Date.now();
    this.saveToStorage({
      status: 'success',
      phoneDisplay,
      msisdn,
      providerName,
      providerCode: providerCode ?? '',
      packages: packages ?? [],
      group1: groups?.group1 ?? [],
      group2: groups?.group2 ?? [],
      group3: groups?.group3 ?? [],
      group4: groups?.group4 ?? [],
      recommendedPackages: groups?.recommendedPackages ?? [],
      savedAt: Date.now()
    });
  }

  setError(): void {
    this.status$.next('error');
  }

  reset(): void {
    this.status$.next('idle');
    this.lookedUpPhoneDisplay$.next(null);
    this.lookedUpMsisdn$.next(null);
    this.lookedUpProviderName$.next(null);
    this.restoredPackages = null;
    this.restoredProviderCode = null;
    this.restoredGroup1 = null;
    this.restoredGroup2 = null;
    this.restoredGroup3 = null;
    this.restoredGroup4 = null;
    this.restoredRecommended = null;
    this.lookupSavedAt = null;
    this.saveToStorage(null);
  }
}
