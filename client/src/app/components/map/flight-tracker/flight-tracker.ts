import { Component, Input, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';

import { SocketService } from '../../../services/server';

interface FlightUpdate {
  flightId: number;
  latitude?: number;
  longitude?: number;
  current_latitude?: number;
  current_longitude?: number;
  progress?: number;
  status?: string;
}

@Component({
  selector: 'app-flight-tracker',
  standalone: true,
  imports: [CommonModule],
  template: '../flight-tracker.html',
  styleUrls: ['../map.css'] // Reuses the shared map styling
})

/*
  Displayes and animates the position of a tracked aircraft.

  This component:
  - Receives a Leaflet map instance from the parent component
  - Listens for live aircraft position updates
  - Animates aircraft movement between recieve coordinates
  - Automatically keeps the aircraft visible on the map
  - Displays flight progress
*/
export class FlightTrackerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) map!: L.Map; // Leaflet map instance supplied by parent component.

  progress = 0; // Current percentage of flight completion

  private socket = inject(SocketService);
  private destroyRef = inject(DestroyRef);

  private aircraftMarker?: L.Marker; // Marker representing the tracked aircraft
  private animFrameId: number | null = null; // current animation frame used for smooth movement.

  // Initialises component by subscribing to live aircraft updates
  ngOnInit(): void {
    this.listenAircraft();
  }

  // Subsribes to aircraft position updates received from the Websocket server.
  private listenAircraft() {
    this.socket.flightUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        console.log("TRACKER ANIMATION UPDATE:", msg);

        const lat = msg.latitude ?? msg.current_latitude;
        const lng = msg.longitude ?? msg.current_longitude;

        if (lat == null || lng == null) return;

        const position = L.latLng(Number(lat), Number(lng));

        // Create the aircraft marker the first time a position update is recieved.
        if (!this.aircraftMarker) {
          this.aircraftMarker = L.marker(position, {
            icon: this.aircraftIcon()
          }).addTo(this.map);

          this.map.flyTo(position, 5);
        }

        // Smoothly animate the aircraft towards its new position
        this.animateMarkerTo(position, 1000);

        //Follow mode, pan when plane leaves visible map (Keep aircraft visible if it leaves the current map view)
        if (!this.map.getBounds().contains(position)) {
          this.map.panTo(position);
        }

        // Update flight progress if supplied by the server. Otherwise increment it grafually for visual feedback.
        if (msg.progress !== undefined) {
          this.progress = msg.progress;
        } else {
          this.progress = Math.min(100, this.progress + 2);
        }
      });
  }

  // Smoothly animates the aircraft marker between two geographical positions.
  private animateMarkerTo(target: L.LatLng, duration = 800) {
    if (!this.aircraftMarker) return;

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const start = this.aircraftMarker.getLatLng();
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = t * (2 - t); // Quadratic ease-out pathing profile

      const lat = start.lat + (target.lat - start.lat) * ease;
      const lng = start.lng + (target.lng - start.lng) * ease;

      this.aircraftMarker?.setLatLng([lat, lng]);

      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  // Creates custom aircraft icon displayed on the map.
  private aircraftIcon() {
    return L.divIcon({
      html: `<div class="aircraft-marker">✈️</div>`,
      className: '',
      iconSize: [45, 45],
      iconAnchor: [22.5, 22.5],
      popupAnchor: [0, -12],
    });
  }

  // Cleans up animation and removes the aircraft marker when the component is destroyed.
  ngOnDestroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.aircraftMarker) {
      this.aircraftMarker.remove();
    }
  }
}
