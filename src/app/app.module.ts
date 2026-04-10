import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeroComponent } from './components/hero/hero.component';
import { DataPackagesComponent } from './components/data-packages/data-packages.component';
import { PaymentMethodComponent } from './components/payment-method/payment-method.component';
import { TermsPoliciesComponent } from './components/terms-policies/terms-policies.component';
import { PaymentResultComponent } from './components/payment-result/payment-result.component';
import { CustomerComplaintModalComponent } from './components/customer-complaint-modal/customer-complaint-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    HeroComponent,
    DataPackagesComponent,
    PaymentMethodComponent,
    TermsPoliciesComponent,
    PaymentResultComponent,
    CustomerComplaintModalComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
