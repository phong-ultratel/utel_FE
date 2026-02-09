import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollToFooter(): void {
    const contactInfo = document.getElementById('contact-info');
    if (contactInfo) {
      contactInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
