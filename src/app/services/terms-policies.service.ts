import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TermsPoliciesService {
  private openModalSubject = new Subject<string | undefined>();
  openModal$ = this.openModalSubject.asObservable();

  openModal(sectionId?: string): void {
    this.openModalSubject.next(sectionId);
  }
}

