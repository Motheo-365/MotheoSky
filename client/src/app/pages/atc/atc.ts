import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapComponent } from '../../components/map/map';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SocketService } from '../../services/server';
import { ToastService } from '../../services/toast';
import { getFlights } from '../../services/api';
import { environment } from '../../../environments/environment';
import { LoadingScreen } from '../../components/loading-screen/loading-screen';

@Component({
  selector: 'app-atc',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent, LoadingScreen],
  templateUrl: './atc.html',
  styleUrls: ['./atc.css']
})

/*
  ATC dashboard component

  This page:
  - Retrieves and displayes available flights
  - Connects to the WebSocket server for live updates
  - Allows ATCs to dispatch and track flights
  - Displays passenger boarding notifications
  - Updates flight information in real time
*/
export class Atc implements OnInit {
  protected socket = inject(SocketService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  readonly API_URL = environment.apiUrl;

  flights: any[] = [];
  selectedFlight: any = null;
  notifications: any[] = [];

  hasLoaded = false;
  errorMessage = '';

  boardingTimerInterval: any = null;
  boardingCountdown = 0;
  isLoading = true; //initial load
  isSelectFlight = false; //load when clicking flight
  isTracking = false;

  // Initialises the page by establishing the WebSocket connection,
  // subscribing to socket events and loading flights
  ngOnInit(): void {
    const apiKey = localStorage.getItem('api_key');
    const username = localStorage.getItem('username');
    const port = localStorage.getItem('ws_port');

    if (apiKey && username && port && !this.socket.isConnected()) {
      this.socket.connect(apiKey, Number(port), username);
    }

    this.subscribeSockets();
    this.getFlights();
  }

  // Subscribes to all WebSocket event streams required by the ATC dahboard
  private subscribeSockets(): void {
    /* Dispatch Flight */
    this.socket.dispatchResult$?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg.data?.status === 'success') {
          this.toast.show('Flight dispatched successfully', 'success');

          //update selected
          if (this.selectedFlight) {
            this.selectedFlight.status = 'Boarding'; // reflect immediately
          }

          //update list
          const flightId = msg.data?.flight_id ?? msg.data?.flightId ?? msg.data?.id;
          if (flightId) {
            const flight = this.flights.find(
              f => f.id === flightId || f.flight_id === flightId
            );
            if (flight) {
              flight.status = 'Boarding';
            }
          }
        } else {
          this.toast.show('Dispatch failed', 'error');
        }
      });

    /* Tracking Success */
    this.socket.trackingSuccess$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.zone.run(() => {
          //console.log("ATC now tracking:", msg.flightId);
          this.isTracking = true;
          this.toast.show(`Tracking flight ${msg.flightId}`, 'success');
        });
      });

    /* --- Aircraft updates --- */
    this.socket.flightUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.zone.run(() => {
          const selectedFlightId =
            this.selectedFlight?.id ?? this.selectedFlight?.flight_id;

          if (this.selectedFlight && msg.flightId === selectedFlightId) {
            this.selectedFlight.current_latitude =
              msg.latitude ?? msg.current_position?.latitude;

            this.selectedFlight.current_longitude =
              msg.longitude ?? msg.current_position?.longitude;

            this.selectedFlight.status = msg.status;
          }
        });
      });

    /* --- Passenger boarded --- */
    this.socket.boardingConfirmed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.zone.run(() => {
          this.notifications.unshift({
            id: Date.now(),
            message: `✓ ${msg.passenger_name} boarded flight ${msg.flightId}`
          });

          if (this.selectedFlight) {
            const passenger = this.selectedFlight.passengers?.find(
              (p: any) => p.id === msg.passenger_id
            );
            if (passenger) passenger.boarded = true;
          }
        });
      });

    /* --- Passenger no-show --- */
    this.socket.noShow$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.zone.run(() => {
          this.notifications.unshift({
            id: Date.now(),
            message: `⚠ ${msg.passenger_name} failed to board flight ${msg.flightId}`
          });
        });
      });

    /* --- Boarding started --- */
    this.socket.boardingNotification$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        this.zone.run(() => {
          this.notifications.unshift({
            id: Date.now(),
            message: `▶ Boarding started for flight ${msg.flightId}`
          });

          const selectedFlightId =
            this.selectedFlight?.id ?? this.selectedFlight?.flight_id;

          if (this.selectedFlight && msg.flightId === selectedFlightId) {
            this.selectedFlight.status = 'Boarding';
            this.startBoardingCountdown();
          }
        });
      });
  }

  // Retrieves all flights from the API
  // and prepares them for display within the dashboard
  async getFlights(): Promise<void> {
    const apiKey = localStorage.getItem('api_key');
    this.isLoading = true;

    if (!apiKey) {
      this.toast.show('Missing API key', 'error');
      this.isLoading = false;
      return;
    }

    try {
      const data = await getFlights(apiKey);

      console.log('Flights API response:', data);

      if (data.status === 'success') {
        // Retrieve latest flight list from the API
        const list = data?.data?.flights || data?.flights || [];

        // Normalise the flight data so that the component uses consisent property names
        // regardless of the API response
        this.flights = list.map((flight: any) => ({
          ...flight,
          id: flight.id ?? flight.flight_id,
          flight_id: flight.flight_id ?? flight.id,
          current_latitude:
            flight.current_position?.latitude ?? null,
          current_longitude:
            flight.current_position?.longitude ?? null,
          passengers: flight.passengers || []
        }));

        //Force UI refresh after list has been updated
        this.cdr.detectChanges();
      }

      else {
        this.toast.show(data.message || 'Unable to load flights', 'error');
        this.isLoading = false;
      }
    }

    catch (error: any) {
      this.toast.show(error?.message || 'Unable to load flights', 'error');
      this.isLoading = false;
    }

    finally {
      this.hasLoaded = true;
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  /*
    Starts the boarding countdown timer and marks any passengers
    who have not boarded before boarding closes.
  */
  startBoardingCountdown(): void {
    // Stop any existing boarding timer
    if (this.boardingTimerInterval) {
      clearInterval(this.boardingTimerInterval);
    }

    this.boardingCountdown = 60; // New 60-second countdown

    // Reduce the remaining time every second
    this.boardingTimerInterval = setInterval(() => {
      this.zone.run(() => {
        if (this.boardingCountdown > 0) {
          this.boardingCountdown--;
        }

        if (this.boardingCountdown === 0) {
          clearInterval(this.boardingTimerInterval);
          this.boardingTimerInterval = null;

          if (this.selectedFlight) {
            const noShows = (this.selectedFlight.passengers || []).filter(
              (p: any) => !p.boarded
            );

            // Identify passengers who failed to board
            noShows.forEach((p: any) => {
              p.noShow = true;
              this.notifications.unshift({
                id: Date.now() + Math.random(),
                message: `⚠ ${p.first_name} ${p.last_name} failed to board flight ${this.selectedFlight.flight_number}`
              });
            });

            this.selectedFlight.status = 'In Flight';
          }
        }
      });
    }, 1000);
  }

  /*
    Retrieves detailed information for the selected flight,
    including passenger lists.
  */
  async selectFlight(flight: any): Promise<void> {
    const apiKey = localStorage.getItem('api_key');
    const flightId = flight.id ?? flight.flight_id;

    this.isTracking = false; // Reset the tracking state while loading
    this.isSelectFlight = true;
    this.isLoading = true;

    this.selectedFlight = flight; // Store selected flight

    //fetch full flight details (WITH passengers)
    try {
      // Request the complete flight details from the API
      const res = await fetch(this.API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'GetFlight',
          api_key: apiKey,
          flight_id: flightId
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        this.selectedFlight = {
          ...data.data,
          passengers: data.data.passengers || []
        };
      }
      else {
        this.toast.show(data.message, 'error');
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

  dispatchFlight(flight: any): void {
    if (flight.status !== 'Scheduled') return;

    const flightId = flight.id ?? flight.flight_id;

    this.socket.dispatchFlight(flightId);

    this.notifications.unshift({
      id: Date.now(),
      message: `✈ Flight ${flight.flight_number} dispatched`
    });
  }

  trackSelectedFlight(): void {
    if (!this.selectedFlight) return;

    const id = this.selectedFlight.id ?? this.selectedFlight.flight_id;
    console.log("ATC TRACK CLICK:", id);

    // 1. Reset UI attributes immediately (synchronously)
    this.selectedFlight.current_latitude = null;
    this.selectedFlight.current_longitude = null;

    // 2. Wrap all state updates and socket emissions inside the async boundary
    setTimeout(() => {
      this.isTracking = true;

      // Only call this once safely inside the microtask tick
      this.socket.trackFlight(id);

      this.toast.show(`Tracking flight ${id}...`, 'success');
      this.cdr.markForCheck();
    }, 0);//to push onto next event loop tick
  }
}
