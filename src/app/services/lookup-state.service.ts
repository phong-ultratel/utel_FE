import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type LookupStatus = 'idle' | 'loading' | 'success' | 'error';

@Injectable({
  providedIn: 'root'
})
export class LookupStateService {
  private readonly status$ = new BehaviorSubject<LookupStatus>('idle');
  private readonly lookedUpPhoneDisplay$ = new BehaviorSubject<string | null>(null);
  private readonly lookedUpProviderName$ = new BehaviorSubject<string | null>(null);

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

  setLoading(): void {
    this.status$.next('loading');
  }

  setSuccess(phoneDisplay: string, providerName: string): void {
    this.status$.next('success');
    this.lookedUpPhoneDisplay$.next(phoneDisplay);
    this.lookedUpProviderName$.next(providerName);
  }

  setError(): void {
    this.status$.next('error');
  }

  reset(): void {
    this.status$.next('idle');
    this.lookedUpPhoneDisplay$.next(null);
    this.lookedUpProviderName$.next(null);
  }
}
