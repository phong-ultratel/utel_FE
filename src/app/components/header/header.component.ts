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
    const section = document.getElementById('lookup-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      const input = document.getElementById('lookup-input') as HTMLInputElement | null;
      input?.focus();
    }, 300);
  }

  scrollToFooter(): void {
    const contactInfo = document.getElementById('contact-info');
    if (contactInfo) {
      contactInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
