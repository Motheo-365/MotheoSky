import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Flight } from '../../interfaces/api';

import { ApiService } from '../../services/api';
import { SocketService } from '../../services/server';
import { ToastService } from '../../services/toast';

import { MapComponent } from '../../components/map/map';


@Component({
  selector: 'app-passenger',
  standalone: true,
  imports: [FormsModule, CommonModule, MapComponent],
  templateUrl: './passenger.html',
  styleUrls: ['./passenger.css'],
})

/*
  Passenger dashboard component.

  This page:
  - Retrieves and displays the passenger's booked flights
  - Connects to the WebSocket server for live flight updates
  - Allows passengers to track their selected flight
  - Receives boarding notifications
  - Allows passengers to board a flight during the boarding window
*/
export class PassengerComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  protected socket = inject(SocketService); // Modern inject pattern consistency
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  flights: Flight[] = [];
  username = '';

  // Tracking state
  trackedFlight: Flight | null = null;
  isTracking = false;
  boardingCountdown = 0;
  isBoardingActive = false;
  isBoarded = false;
  boardingTimerInterval: number | null = null;
  isSelectFlight = false; //load when clicking flight
  isLoading = false;

  hasLoaded = false;
  errorMessage = '';

  private subscriptions: Subscription[] = [];

  /*
    initialises the passenger dashboard by establishing the Websocket connection and subscribing to real-time events.
  */
  ngOnInit() {
    const apiKey = localStorage.getItem('api_key');
    const username = localStorage.getItem('username');
    const port = localStorage.getItem('ws_port');

    if (apiKey && username && port && !this.socket.isConnected()) {
      this.socket.connect(apiKey, Number(port), username);
    }

    // Keep instant stream registrations here safely
    this.subscribeToSocketUpdates();
  }

  /*
    Loads the passengers flights once the view has been initialised.
    A timeout is used to avoid Angulars ExpressionCHangeAfterItHasBeenCheckedError.
  */
  ngAfterViewInit() {
    // Use setTimeout to push the asynchronous fetch logic cleanly
    // into the next JavaScript VM macro-turn, bypassing the NG0100 guard.
    setTimeout(async () => {
      await this.getFlights();
    });
  }

  /*
    Cleans up active subsribers and timers when the component is destroyed to prevent memory leaks.
  */
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
  }

  /*
    Subsribe to all WebSocket events required by the passenger dahsboard, including flight tracking updates and boarding notifications.
  */
  private subscribeToSocketUpdates() {
    //  Tracking SUccess
    this.subscriptions.push(
      this.socket.trackingSuccess$.subscribe((msg) => {
        this.isTracking = true;
        console.log('Tracking flight:', msg);
      })
    );

    // Flight Updates
    this.subscriptions.push(
      this.socket.flightUpdate$.subscribe((msg) => {
        if (this.trackedFlight && msg.flightId === this.trackedFlight.id) {
          this.trackedFlight.current_position.latitude = msg.latitude;

          this.trackedFlight.current_position.longitude = msg.longitude;

          this.trackedFlight.status = msg.status;
        }
        if (msg.status === 'Boarding' && !this.isBoardingActive) {
          this.isBoardingActive = true;
          this.startBoardingTimer();
        }
        if (msg.status === 'In Flight') {
          this.isBoardingActive = false;
        }
      })
    );

    //
    this.subscriptions.push(
      this.socket.boardingStarted$.subscribe((msg) => {
        console.log("BOARDING EVENT RECEIVED", msg);

        this.zone.run(() => {
          if (this.trackedFlight && msg.flightId === this.trackedFlight.id) {
            this.trackedFlight.status = 'Boarding';
            this.isBoardingActive = true;
            this.boardingCountdown = 60;
            this.startBoardingTimer();
          }
        });
      })
    );

    // boarded
    this.subscriptions.push(
      this.socket.boardingResults$.subscribe((msg) => {
        this.zone.run(() => {

          if (msg.data.status === 'success') {
            this.isBoarded = true;
            this.isBoardingActive = false;

            if (this.boardingTimerInterval) {
              clearInterval(this.boardingTimerInterval);
            }

            this.toast.show(
              msg.data.message ?? 'Boarding successful.',
              'success'
            );
          } else {
            this.toast.show( // no show
              msg.data.message ?? 'Unable to board flight.',
              'error'
            );
          }

        });
      })
    );
  }

  async selectFlight(flight: Flight): Promise<void> {
    const apiKey = localStorage.getItem('api_key');
    const flightId = flight.id;

    this.isTracking = false; // Reset the tracking state while loading
    this.isSelectFlight = true;
    this.isLoading = true;

    this.trackedFlight = flight; // Store selected flight

    //fetch full flight details (WITH passengers)
    try {
      const data = await this.api.getFlight(apiKey!, flightId);

      if (data.status === 'success' && data.data) {
        this.trackedFlight = {
          ...data.data,
          passengers: data.data.passengers || []
        };
      }
      else {
        this.toast.show(data.message ?? 'Unable to retrieve flight.', 'error');
        this.isLoading = false;
      }
    }
    catch (err) {
      console.error(err);
      this.isLoading = false;
    }
    finally {
      this.isLoading = false;
      this.isSelectFlight = false;
    }
  }

  /*
    Starts the boarding countdown timer.
    Once the timer expires, boarding closes and the flight transitions to the 'In Flight' state.
  */
  private startBoardingTimer() {
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);

    this.boardingCountdown = 60;

    this.boardingTimerInterval = setInterval(() => {
      this.zone.run(() => {
        if (this.boardingCountdown > 0) {
          this.boardingCountdown--;
        }

        if (this.boardingCountdown === 0) {
          if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
          this.isBoardingActive = false;

          if (this.trackedFlight) {
            this.trackedFlight.status = 'In Flight';
          }
        }
      });
    }, 1000);
  }

  /*
    get all flights booked by the currently subsribed authenticated passenger and prepares them for display within the dashboard.
  */
  async getFlights() {
      const currentApiKey = localStorage.getItem('api_key');

      if (!currentApiKey) {
        this.zone.run(() => {
          this.errorMessage = 'No API key found. Please log in again.';
          this.hasLoaded = true;
        });
        this.toast.show(this.errorMessage, 'error');
        this.cdr.detectChanges(); // Force stabilization after layout branch shift
        return;
      }

      try {
       const data = await this.api.getFlights(currentApiKey);

       //Proceed normally if parsing suceeds
        this.zone.run(() => {
          if (data.status === 'success') {
            const flightList =  data.data?.flights || [];

            this.flights = flightList.map((flight: Flight) => {
              const pos = flight.current_position || {};
              return {
                ...flight,
                id: flight.id,
                flight_id: flight.id,
                current_latitude: pos.latitude ?? null,
                current_longitude: pos.longitude ?? null,
              };
            });
          } else {
            this.errorMessage = data.message || 'Unable to load flights.';
            this.toast.show(this.errorMessage, 'error');
          }
          this.hasLoaded = true;
          this.cdr.detectChanges(); // Ensure the view updates safely on network response/failure
        });

      } catch (error: any) {
        this.zone.run(() => {
          this.errorMessage = error?.message || 'Unable to load flights.';
          this.hasLoaded = true;
        });
        this.toast.show(this.errorMessage, 'error');
        this.cdr.detectChanges(); // Stabilize on fatal network catch blocks
      }
    }

  // Begins tracking the selected flight and requests live position updates from the WebSocker server.
  async trackFlight(flight: Flight) {
    this.trackedFlight = flight;
    this.isTracking = true;
    const flightId = flight.id;
    this.socket.trackFlight(flightId);
  }

  // Stops tracking the selected flight and resets the passenger tracking state.
  stopTracking() {
    this.isTracking = false;
    this.trackedFlight = null;
    this.isBoardingActive = false;
    this.isBoarded = false;
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
  }

  // Sends a boarding request for the currently tracked flight. Boarding is only permitted while the boarding window is active.
  boardFlight() {
    if (this.trackedFlight) {
      this.socket.boardFlight(this.trackedFlight.id);
    }
  }
}
