import { Routes } from '@angular/router';
import { Login } from './pages/login/login'
import { Passenger } from './pages/passenger/passenger'
import { Atc } from './pages/atc/atc'
import { RoleGuard } from './guards/role-guard'
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'passenger',
    component: Passenger,
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
