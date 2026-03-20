import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PaymentResultComponent } from './components/payment-result/payment-result.component';

const routes: Routes = [
  { path: 'payment-result', component: PaymentResultComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
