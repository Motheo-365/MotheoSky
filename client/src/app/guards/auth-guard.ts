import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {

  const router = inject(Router);

  const apiKey = localStorage.getItem('api_key');

  if (!apiKey) {
    return router.parseUrl('/login');
  }
  return true;
};
