import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DataPackagesComponent } from './components/data-packages/data-packages.component';
import { PaymentResultComponent } from './components/payment-result/payment-result.component';

const routes: Routes = [
  { path: '', component: DataPackagesComponent },
  { path: 'payment-result', component: PaymentResultComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
