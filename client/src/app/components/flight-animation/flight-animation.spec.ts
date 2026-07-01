import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightAnimation } from './flight-animation';

describe('FlightAnimation', () => {
  let component: FlightAnimation;
  let fixture: ComponentFixture<FlightAnimation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightAnimation],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightAnimation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
