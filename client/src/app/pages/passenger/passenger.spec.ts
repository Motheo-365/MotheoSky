import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Passenger } from './passenger';

describe('Passenger', () => {
  let component: Passenger;
  let fixture: ComponentFixture<Passenger>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Passenger],
    }).compileComponents();

    fixture = TestBed.createComponent(Passenger);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
