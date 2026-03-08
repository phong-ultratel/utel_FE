import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { LookupStateService, LookupStatus } from '../../services/lookup-state.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  isMenuOpen = false;
  lookupStatus$!: Observable<LookupStatus>;
  lookedUpPhoneDisplay$!: Observable<string | null>;

  constructor(private lookupState: LookupStateService) {}

  ngOnInit(): void {
    this.lookupStatus$ = this.lookupState.getStatus();
    this.lookedUpPhoneDisplay$ = this.lookupState.getLookedUpPhoneDisplay();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollToLookup(): void {
    const el = document.getElementById('lookup-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus vào input "Nhập số thuê bao" sau khi scroll xong
      setTimeout(() => {
        const input = document.getElementById('lookup-input') as HTMLInputElement | null;
        input?.focus();
      }, 400);
    }
  }

  scrollToFooter(): void {
    const contactInfo = document.getElementById('contact-info');
    if (contactInfo) {
      contactInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
