import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login'
import { PassengerComponent } from './pages/passenger/passenger'
import { Atc } from './pages/atc/atc'
import { RoleGuard } from './guards/role-guard'
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  {
    path: 'passenger',
    component: PassengerComponent,
    canActivate: [authGuard, RoleGuard],
    data: { role: 'Passenger'}
  },
  {
    path: 'atc',
    component: Atc,
    canActivate: [authGuard, RoleGuard],
    data: { role: 'ATC'}
  }
];
