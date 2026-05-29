import { Component, OnInit } from '@angular/core';
import { AttributionService } from './services/attribution.service';
import { VisitTrackingService } from './services/visit-tracking.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'utel_FE';

  constructor(
    private visitTrackingService: VisitTrackingService,
    private _attribution: AttributionService
  ) {}

  ngOnInit(): void {
    this.visitTrackingService.trackVisit().subscribe({
      next: res => {
        const status = res.headers.get('X-Visit-Status');
        if (status && status !== 'saved') {
          console.warn('[visit-tracking]', status);
        }
      },
      error: err => {
        console.warn('[visit-tracking] request failed', err?.status);
      }
    });
  }
}
