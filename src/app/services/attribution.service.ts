import { Injectable } from '@angular/core';

const VISITOR_SESSION_KEY = 'utel_visitor_id';
const ATTRIBUTION_KEY = 'utel_attribution';
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  trafficSourceId?: number | null;
  capturedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AttributionService {
  constructor() {
    this.captureFromCurrentUrl();
  }

  /** ID phiên thống nhất cho visit, tra cứu và đơn hàng. */
  getOrCreateVisitorSessionId(): string {
    try {
      const existing = sessionStorage.getItem(VISITOR_SESSION_KEY);
      if (existing) {
        return existing;
      }
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof (crypto as Crypto).randomUUID === 'function'
          ? (crypto as Crypto).randomUUID()
          : `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(VISITOR_SESSION_KEY, id);
      return id;
    } catch {
      return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }

  getAttribution(): StoredAttribution | null {
    try {
      const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredAttribution;
      if (!parsed.capturedAt || Date.now() - parsed.capturedAt > ATTRIBUTION_TTL_MS) {
        sessionStorage.removeItem(ATTRIBUTION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /** Đọc UTM từ URL hiện tại (last-touch trong phiên). */
  captureFromCurrentUrl(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const hasUtm =
        params.has('utm_source') ||
        params.has('utm_medium') ||
        params.has('utm_campaign') ||
        params.has('utm_content') ||
        params.has('utm_term');
      if (!hasUtm) {
        return;
      }
      const attribution: StoredAttribution = {
        utmSource: params.get('utm_source') ?? undefined,
        utmMedium: params.get('utm_medium') ?? undefined,
        utmCampaign: params.get('utm_campaign') ?? undefined,
        utmContent: params.get('utm_content') ?? undefined,
        utmTerm: params.get('utm_term') ?? undefined,
        capturedAt: Date.now()
      };
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
      // ignore
    }
  }

  utmPayload(): Record<string, string> {
    const a = this.getAttribution();
    const payload: Record<string, string> = {};
    if (!a) {
      return payload;
    }
    if (a.utmSource) payload['utmSource'] = a.utmSource;
    if (a.utmMedium) payload['utmMedium'] = a.utmMedium;
    if (a.utmCampaign) payload['utmCampaign'] = a.utmCampaign;
    if (a.utmContent) payload['utmContent'] = a.utmContent;
    if (a.utmTerm) payload['utmTerm'] = a.utmTerm;
    return payload;
  }
}
