import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightTracker } from './flight-tracker';

describe('FlightTracker', () => {
  let component: FlightTracker;
  let fixture: ComponentFixture<FlightTracker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightTracker],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightTracker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
