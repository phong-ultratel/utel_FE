import { Component, OnInit, OnDestroy } from '@angular/core';
import { SearchService } from '../../services/search.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  searchQuery = '';
  isSearchFocused = false;
  private destroy$ = new Subject<void>();

  constructor(private searchService: SearchService) { }

  ngOnInit(): void {
    // Subscribe để đồng bộ search query từ service
    this.searchService.searchQuery$
      .pipe(takeUntil(this.destroy$))
      .subscribe(query => {
        this.searchQuery = query;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  onSearch(): void {
    // Cập nhật search query vào service
    this.searchService.setSearchQuery(this.searchQuery.trim());
  }

  onSearchInput(): void {
    // Tìm kiếm real-time khi người dùng nhập
    this.searchService.setSearchQuery(this.searchQuery.trim());
  }

  onSearchFocus(): void {
    this.isSearchFocused = true;
  }

  onSearchBlur(): void {
    this.isSearchFocused = false;
  }
}
