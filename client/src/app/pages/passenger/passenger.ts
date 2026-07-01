import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapComponent } from '../../components/map/map';
import { SocketService } from '../../services/server';
import { ToastService } from '../../services/toast';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-passenger',
  standalone: true,
  imports: [FormsModule, CommonModule, MapComponent],
  templateUrl: './passenger.html',
  styleUrls: ['./passenger.css'],
})
export class Passenger implements OnInit, OnDestroy, AfterViewInit {
  socket = inject(SocketService); // Modern inject pattern consistency
  toast = inject(ToastService);
  cdr = inject(ChangeDetectorRef);
  zone = inject(NgZone);

  flights: any[] = [];
  username = '';
  API_URL = environment.apiUrl;

  // Tracking state
  trackedFlight: any = null;
  isTracking = false;
  boardingCountdown = 0;
  isBoardingActive = false;
  isBoarded = false;
  boardingTimerInterval: any;

  hasLoaded = false;
  errorMessage = '';

  private subscriptions: Subscription[] = [];

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
  
  ngAfterViewInit() {
    // Use setTimeout to push the asynchronous fetch logic cleanly
    // into the next JavaScript VM macro-turn, bypassing the NG0100 guard.
    setTimeout(async () => {
      await this.getFlights();
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
  }

  private subscribeToSocketUpdates() {
    this.subscriptions.push(
      this.socket.trackingSuccess$.subscribe((msg) => {
        this.isTracking = true;
        console.log('Tracking flight:', msg);
      })
    );

    this.subscriptions.push(
      this.socket.flightUpdate$.subscribe((msg) => {
        if (this.trackedFlight && msg.flightId === this.trackedFlight.id) {
          this.trackedFlight.current_latitude =
            msg.latitude ?? msg.current_position?.latitude;

          this.trackedFlight.current_longitude =
            msg.longitude ?? msg.current_position?.longitude;

          this.trackedFlight.status = msg.status;
        }
      })
    );

    this.subscriptions.push(
      this.socket.boardingNotification$.subscribe((msg) => {
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
  }

  private startBoardingTimer() {
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);

    this.boardingCountdown = 60;

    this.boardingTimerInterval = setInterval(() => {
      this.zone.run(() => {
        if (this.boardingCountdown > 0) {
          this.boardingCountdown--;
        }

        if (this.boardingCountdown === 0) {
          clearInterval(this.boardingTimerInterval);
          this.isBoardingActive = false;

          if (this.trackedFlight) {
            this.trackedFlight.status = 'In Flight';
          }
        }
      });
    }, 1000);
  }

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
        const res = await fetch(this.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'GetAllFlights',
            api_key: currentApiKey
          }),
        });

        //Get raw text first
        const text = await res.text();
        //Ttry to parse it
        let data;
        try {
          data = JSON.parse(text);
        }

        catch(jsonError) {
          console.error('Backend returned non-JSON HTML: ', text);
          this.zone.run(() => {
            this.errorMessage = 'Server error. Check browser console for details.';
            this.hasLoaded = true;
            this.cdr.detectChanges();
          });
          this.toast.show(this.errorMessage, 'error');
          return;
        }

       // const data = await res.json();

       //Proceed normally if parsing suceeds
        this.zone.run(() => {
          if (data.status === 'success') {
            const flightList = Array.isArray(data.data)
              ? data.data
              : data.data?.flights || [];

            this.flights = flightList.map((flight: any) => {
              const pos = flight.current_position || {};
              return {
                ...flight,
                id: flight.id ?? flight.flight_id,
                flight_id: flight.flight_id ?? flight.id,
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

  async trackFlight(flight: any) {
    this.trackedFlight = flight;
    this.isTracking = true;
    const flightId = flight.id ?? flight.flight_id;
    this.socket.trackFlight(flightId);
  }

  stopTracking() {
    this.isTracking = false;
    this.trackedFlight = null;
    this.isBoardingActive = false;
    this.isBoarded = false;
    if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
  }

  boardFlight() {
    if (this.trackedFlight) {
      this.socket.boardFlight(this.trackedFlight.id);
      this.isBoarded = true;
      this.isBoardingActive = false;
      if (this.boardingTimerInterval) clearInterval(this.boardingTimerInterval);
    }
  }
}
