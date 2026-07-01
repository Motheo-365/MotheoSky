import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: WebSocket;
  private lastPort!: number;

  // Subjects matching the ATC component expectations
  flightUpdate$ = new Subject<any>();
  trackingSuccess$ = new Subject<any>();
  boardingNotification$ = new Subject<any>(); // Keeps support for general boarding starts
  boardingConfirmed$ = new Subject<any>();    // Triggers when an individual passenger boards
  noShow$ = new Subject<any>();               // Triggers on passenger missing flight
  dispatchResult$ = new Subject<any>();

  connect(apiKey: string, port: number, username: string): void {
    if (!port) {
      console.error("Port required");
      return;
    }

    this.lastPort = port;

    const target = `${environment.websocketServer.protocol}://${environment.websocketServer.host}`;
    console.log("Connecting websocket: ", target);

    this.socket = new WebSocket(target);

    this.socket.onopen = () => {
      console.log(`${username} connected on port: ${port}`);
      this.send({
        type: "AUTH",
        api_key: apiKey,
        username,
        user_id: localStorage.getItem('user_id'),
        user_type: localStorage.getItem('user_type'),
      });
    };

    this.socket.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data as string);

        if (msg.type === 'flight_update' || msg.type === 'FLIGHT_UPDATE') {
          this.flightUpdate$.next(msg); //Push event data directly onto map
        }
      }
      catch (jsonError) {
        console.error('WebSocket parse error:', jsonError, 'raw message:', event.data);
        return;
      }
      this.handleMessage(msg);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  send(data: any): void {
    console.log('SEND attempt:', data, 'readyState:', this.socket?.readyState);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Socket not open, message dropped:', data);
    }
  }

  trackFlight(flightId: number): void {
    this.send({ type: 'TRACK', flightId: flightId });
  }

  boardFlight(flightId: number): void {
    this.send({ type: 'BOARD', flightId: flightId });
  }

  // Added method required by the ATC interface
  dispatchFlight(flightId: number): void {
    this.send({ type: 'DISPATCH', flightId: flightId });
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private handleMessage(msg: any): void {
    switch(msg.type) {
      case 'AUTH_SUCCESS':
        console.log('Authenticated');
        this.send({
          type: "SET_PORT",
          port: this.lastPort
        })
        break;

      case 'TRACK_SUCCESS':
        console.log('Now tracking flight:', msg.flightId);
        this.trackingSuccess$.next(msg);
        break;

      case 'FLIGHT_UPDATE':
        console.log('Live update:', msg);
        this.flightUpdate$.next(msg);
        break;

      case 'DISPATCH_RESULT':
        console.log('Dispatch result:', msg);
        this.dispatchResult$.next(msg);
        break;


      case 'BOARDING_STARTED':
        console.log('Boarding started:', msg);
        this.boardingNotification$.next(msg);
        break;

      case 'BOARDING_CONFIRMED': // Maps incoming socket messages to component listener
        console.log('Passenger boarded:', msg);
        this.boardingConfirmed$.next(msg);
        break;

      case 'NO_SHOW': // Maps incoming socket no-shows to component listener
        console.log('Passenger no-show:', msg);
        this.noShow$.next(msg);
        break;

      case 'AUTH_FAILED':
        console.error('WebSocket auth failed:', msg.message);
        break;

      case 'ERROR':
        console.error('Server error:', msg.message);
        break;

      case 'KILLED':
        alert(msg.message);
        this.socket.close();
        break;

      default:
        console.log('Unknown message payload:', msg);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
  }
}

