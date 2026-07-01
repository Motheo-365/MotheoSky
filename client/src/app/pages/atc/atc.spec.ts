import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Atc } from './atc';

describe('Atc', () => {
  let component: Atc;
  let fixture: ComponentFixture<Atc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Atc],
    }).compileComponents();

    fixture = TestBed.createComponent(Atc);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
