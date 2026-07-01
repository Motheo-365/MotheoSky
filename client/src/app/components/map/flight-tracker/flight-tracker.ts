import { Component, Input, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { SocketService } from '../../../services/server';

@Component({
  selector: 'app-flight-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="progress-box" *ngIf="progress > 0">
      Flight Progress: <strong>{{ progress }}%</strong>
    </div>
  `,
  styleUrls: ['../map.css'] // Reuses progress-box styling configurations safely
})
export class FlightTrackerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) map!: L.Map;

  progress = 0;
  private socket = inject(SocketService);
  private destroyRef = inject(DestroyRef);

  private aircraftMarker?: L.Marker;
  private animFrameId: number | null = null;

  ngOnInit() {
    this.listenAircraft();
  }

  private listenAircraft() {
    this.socket.flightUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        console.log("TRACKERAMATION UPDATE:", msg);

        const lat = msg.latitude ?? msg.current_latitude;
        const lng = msg.longitude ?? msg.current_longitude;

        if (lat == null || lng == null) return;

        const position = L.latLng(Number(lat), Number(lng));

        if (!this.aircraftMarker) {
          this.aircraftMarker = L.marker(position, {
            icon: this.aircraftIcon()
          }).addTo(this.map);

          this.map.flyTo(position, 5);
        }

        this.animateMarkerTo(position, 1000);
        //Follow mode, pan when plane leaves visible map
        if (!this.map.getBounds().contains(position)) {
          this.map.panTo(position);
        }

        if (msg.progress !== undefined) {
          this.progress = msg.progress;
        } else {
          this.progress = Math.min(100, this.progress + 2);
        }
      });
  }

  private animateMarkerTo(target: L.LatLng, duration = 800) {
    if (!this.aircraftMarker) return;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const start = this.aircraftMarker.getLatLng();
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = t * (2 - t); // Quad ease-out pathing profile

      const lat = start.lat + (target.lat - start.lat) * ease;
      const lng = start.lng + (target.lng - start.lng) * ease;

      this.aircraftMarker?.setLatLng([lat, lng]);

      if (t < 1) {
        this.animFrameId = requestAnimationFrame(step);
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  private aircraftIcon() {
    return L.divIcon({
      html: `<div class="aircraft-marker">✈️</div>`,
      className: '',
      iconSize: [45, 45],
      iconAnchor: [22.5, 22.5],
      popupAnchor: [0, -12],
    });
  }

  ngOnDestroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.aircraftMarker) {
      this.aircraftMarker.remove();
    }
  }
}
