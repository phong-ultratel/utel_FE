import { Component, OnInit } from '@angular/core';
import { TermsPoliciesService } from '../../services/terms-policies.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

  constructor(private termsPoliciesService: TermsPoliciesService) { }

  ngOnInit(): void {
  }

  openTermsModal(sectionId?: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.termsPoliciesService.openModal(sectionId);
  }
}
