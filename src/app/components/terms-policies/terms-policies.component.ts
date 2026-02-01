import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TermsPoliciesService, PolicySection } from '../../services/terms-policies.service';

@Component({
  selector: 'app-terms-policies',
  templateUrl: './terms-policies.component.html',
  styleUrls: ['./terms-policies.component.scss']
})
export class TermsPoliciesComponent implements OnInit, OnDestroy {
  showModal: boolean = false;
  selectedSection: string = 'terms-of-use';
  private subscription?: Subscription;
  policySections: PolicySection[] = [];
  isLoading: boolean = false;

  constructor(private termsPoliciesService: TermsPoliciesService) { }

  ngOnInit(): void {
    // Load policy sections from API
    this.loadPolicySections();

    this.subscription = this.termsPoliciesService.openModal$.subscribe(sectionId => {
      if (sectionId) {
        this.selectedSection = sectionId;
      }
      this.openModal();
    });
  }

  loadPolicySections(): void {
    this.isLoading = true;
    this.termsPoliciesService.getPolicySections().subscribe({
      next: (sections) => {
        this.policySections = sections;
        // Nếu không có section nào được chọn hoặc section đã chọn không tồn tại, chọn section đầu tiên
        if (this.policySections.length > 0) {
          if (!this.policySections.find(s => s.id === this.selectedSection)) {
            this.selectedSection = this.policySections[0].id;
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading policy sections:', error);
        this.isLoading = false;
        // Fallback: sử dụng empty array nếu có lỗi
        this.policySections = [];
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  openModal(): void {
    this.showModal = true;
    // Chỉ reset selectedSection nếu chưa có section nào được chọn hoặc section không tồn tại
    if (!this.selectedSection || !this.policySections.find(s => s.id === this.selectedSection)) {
      if (this.policySections.length > 0) {
        this.selectedSection = this.policySections[0].id;
      } else {
        this.selectedSection = 'terms-of-use';
      }
    }
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.showModal = false;
    document.body.style.overflow = '';
  }

  selectSection(sectionId: string): void {
    this.selectedSection = sectionId;
  }

  getCurrentSection(): PolicySection | undefined {
    return this.policySections.find(section => section.id === this.selectedSection);
  }
}

