import { Component, OnInit } from '@angular/core';
import { VisitTrackingService } from './services/visit-tracking.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'utel_FE';

  constructor(private visitTrackingService: VisitTrackingService) {}

  ngOnInit(): void {
    // Gửi request tracking 1 lần khi FE khởi tạo
    this.visitTrackingService.trackVisit().subscribe({
      next: () => {},
      error: () => {
        // Không để lỗi tracking ảnh hưởng đến trải nghiệm người dùng
      }
    });
  }
}
