import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type LookupStatus = 'idle' | 'loading' | 'success' | 'error';

const STORAGE_KEY = 'utel_lookup_state';

export interface PersistedLookupState {
  status: LookupStatus;
  phoneDisplay: string;
  providerName: string;
  providerCode: string;
  packages: unknown[];
}

@Injectable({
  providedIn: 'root'
})
export class LookupStateService {
  private readonly status$ = new BehaviorSubject<LookupStatus>('idle');
  private readonly lookedUpPhoneDisplay$ = new BehaviorSubject<string | null>(null);
  private readonly lookedUpProviderName$ = new BehaviorSubject<string | null>(null);
  private restoredPackages: unknown[] | null = null;
  private restoredProviderCode: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: PersistedLookupState = JSON.parse(raw);
      if (state.status !== 'success' || !state.phoneDisplay) return;
      this.status$.next('success');
      this.lookedUpPhoneDisplay$.next(state.phoneDisplay);
      this.lookedUpProviderName$.next(state.providerName ?? null);
      this.restoredPackages = Array.isArray(state.packages) ? state.packages : null;
      this.restoredProviderCode = state.providerCode ?? null;
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
  }

  setLoading(): void {
    this.status$.next('loading');
  }

  setSuccess(
    phoneDisplay: string,
    providerName: string,
    providerCode?: string,
    packages?: unknown[]
  ): void {
    this.status$.next('success');
    this.lookedUpPhoneDisplay$.next(phoneDisplay);
    this.lookedUpProviderName$.next(providerName);
    this.restoredPackages = null;
    this.restoredProviderCode = null;
    this.saveToStorage({
      status: 'success',
      phoneDisplay,
      providerName,
      providerCode: providerCode ?? '',
      packages: packages ?? []
    });
  }

  setError(): void {
    this.status$.next('error');
  }

  reset(): void {
    this.status$.next('idle');
    this.lookedUpPhoneDisplay$.next(null);
    this.lookedUpProviderName$.next(null);
    this.restoredPackages = null;
    this.restoredProviderCode = null;
    this.saveToStorage(null);
  }
}
