import { Input, Component, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { FlightTrackerComponent } from './flight-tracker/flight-tracker';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FlightTrackerComponent],
  templateUrl: './map.html',
  styleUrls: ['./map.css'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @Input() flights: any[] = [];

  protected mapInstance?: L.Map; // Shared safely with template bindings via @if checks
  private airportMarkers: L.Marker[] = [];
  private API_URL = environment.apiUrl;

  ngAfterViewInit() {
    this.initMap();
    this.loadAirports();
  }

  private initMap() {
    this.mapInstance = L.map('map', {
      scrollWheelZoom: true,
      zoomControl: true,
      dragging: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: false
    }).setView([20, 0], 2);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap',
      noWrap: true,
      bounds: [[-85, -180], [85, 180]]
    }).addTo(this.mapInstance);

    setTimeout(() => {
      this.mapInstance?.invalidateSize();
    }, 300);
  }

  private async loadAirports() {
    const apiKey = localStorage.getItem('api_key');
    if (!this.mapInstance) return;

    try {
      const res = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'GetAirports', api_key: apiKey }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        const usedAirports = new Set(
          this.flights.flatMap((f: any) => [f.origin?.code, f.destination?.code])
        );

        data.data.forEach((airport: any) => {
          if (!usedAirports.has(airport.code)) return;

          const marker = L.marker([airport.latitude, airport.longitude], {
            icon: this.airportIcon(),
            keyboard: false,
          }).addTo(this.mapInstance!);

          marker.bindPopup(`<b>${airport.name}</b><br>${airport.code}`);
          this.airportMarkers.push(marker);
        });
      }
    } catch (error) {
      console.error('Failed to load airports:', error);
    }
  }

  private airportIcon() {
    return L.divIcon({
      html: `<div class="airport-marker">🏢</div>`,
      className: '',
      popupAnchor: [0, -10],
    });
  }

  ngOnDestroy() {
    this.airportMarkers.forEach(m => m.remove());
    if (this.mapInstance) this.mapInstance.remove();
  }

  ngOnChanges() {
      if (!this.initMap) return;
    }
  }
