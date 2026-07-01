import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { RoleGuard } from './role-guard';

describe('roleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() =>
      TestBed.inject(RoleGuard).canActivate(guardParameters as any)
    );

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
