import { Component, OnInit } from '@angular/core';
import { TermsPoliciesService } from '../../services/terms-policies.service';
import { LookupStateService } from '../../services/lookup-state.service';
import { CustomerComplaintDefaults } from '../customer-complaint-modal/customer-complaint-modal.component';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  footerComplaintVisible = false;
  footerComplaintDefaults: CustomerComplaintDefaults | null = null;

  constructor(private termsPoliciesService: TermsPoliciesService, private lookupState: LookupStateService) {}

  ngOnInit(): void {}

  openTermsModal(sectionId?: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.termsPoliciesService.openModal(sectionId);
  }

  openComplaintFromFooter(): void {
    const msisdn = this.lookupState.currentLookedUpMsisdn;
    let phone = '';
    if (msisdn && String(msisdn).trim()) {
      const digits = String(msisdn).replace(/\D/g, '');
      const nine = digits.slice(-9).padStart(9, '0');
      phone = '0' + nine;
    }
    this.footerComplaintDefaults = {
      entryPoint: 'FOOTER',
      phoneNumber: phone,
      customerName: '',
      email: '',
      relatedOrderId: null
    };
    this.footerComplaintVisible = true;
  }
}
