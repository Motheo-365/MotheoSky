import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})

export class RoleGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRole = route.data['role'];
    const userRole = localStorage.getItem('user_type');

    // not logged in
    if (!userRole) {
      this.router.navigate(['/']);
      return false;
    }

    // wrong role
    if (userRole !== expectedRole) {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }
}
