import { Component, OnInit, inject, DestroyRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Flight, Passenger} from '../../interfaces/api';

import { MapComponent } from '../../components/map/map';
import { LoadingScreen } from '../../components/loading-screen/loading-screen';

import { SocketService } from '../../services/server';
import { ToastService } from '../../services/toast';
import { ApiService } from '../../services/api';

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
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  flights: Flight[] = [];
  selectedFlight: Flight | null = null;
  notifications: {
    id: number;
    message: string;
  }[] = [];

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
              f => f.id === flightId
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
            this.selectedFlight?.id ?? this.selectedFlight?.id;

          if (this.selectedFlight && msg.flightId === selectedFlightId) {
            this.selectedFlight.current_position.latitude =
              msg.latitude ?? msg.current_position?.latitude;

            this.selectedFlight.current_position.longitude =
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
              (p: Passenger) => p.id === msg.passenger_id
            );
            if (passenger) passenger.status = 'Boarded';
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
            this.selectedFlight?.id ?? this.selectedFlight?.id;

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
      const data = await this.api.getFlights(apiKey);

      console.log('Flights API response:', data);

      if (data.status === 'success') {
        // Retrieve latest flight list from the API
        const list = data.data?.flights ?? [];

        // Normalise the flight data so that the component uses consisent property names
        // regardless of the API response
        this.flights = list.map((flight: Flight) => ({
          ...flight,
          flight: flight.id,
          flight_id: flight.id,
          current_latitude:
            flight.current_position.latitude ?? null,
          current_longitude:
            flight.current_position.longitude ?? null,
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

        // Once boarding closes, identify passengers who filed to board
        if (this.boardingCountdown === 0) {
          clearInterval(this.boardingTimerInterval);
          this.boardingTimerInterval = null;

          if (this.selectedFlight) {
            const selectedFlight = this.selectedFlight;

            const noShows = (selectedFlight.passengers || []).filter(
              (p: Passenger) => p.status !== 'Boarded'
            );

            // Identify passengers who failed to board
            noShows.forEach((p: Passenger) => {
              p.status = 'No Show';

              this.notifications.unshift({
                id: Date.now() + Math.random(),
                message: `⚠ ${p.username} failed to board flight ${selectedFlight.flight_number}`
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
  async selectFlight(flight: Flight): Promise<void> {
    const apiKey = localStorage.getItem('api_key');
    const flightId = flight.id;

    this.isTracking = false; // Reset the tracking state while loading
    this.isSelectFlight = true;
    this.isLoading = true;

    this.selectedFlight = flight; // Store selected flight

    //fetch full flight details (WITH passengers)
    try {
      const data = await this.api.getFlight(apiKey!, flightId);

      if (data.status === 'success' && data.data) {
        this.selectedFlight = {
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
    Dispatches a scheduled flight through the WebSocket server and records the action in the notifications list.
  */
  dispatchFlight(flight: any): void {
    if (flight.status !== 'Scheduled') return; // Only dispatch selected flight(s)

    const flightId = flight.id ?? flight.flight_id;

    this.socket.dispatchFlight(flightId); // Dispatch using flight Id of selected flight

    this.notifications.unshift({ // Alert/Message that flight has been dispatched
      id: Date.now(),
      message: `✈ Flight ${flight.flight_number} dispatched`
    });
  }

  /*
    Begins tracking the currently selected flight and request live position updates from the server
  */
  trackSelectedFlight(): void {
    if (!this.selectedFlight) return;

    const id = this.selectedFlight?.id;
    console.log("ATC TRACK CLICK:", id);

    // 1. Clear previous aircraft positions before tracking starts
    this.selectedFlight.current_position.latitude = null;
    this.selectedFlight.current_position.longitude = null;

    // 2. Wrap all state updates and socket emissions inside the async boundary
    // Schedule the tracking request for the next event loop tick to ensure the UI updates correctly
    setTimeout(() => {
      this.isTracking = true;

      // Only call this once safely inside the microtask tick
      this.socket.trackFlight(id);

      this.toast.show(`Tracking flight ${id}...`, 'success');
      this.cdr.markForCheck();
    }, 0);// to push onto next event loop tick
  }
}
