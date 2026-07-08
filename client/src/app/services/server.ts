import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { FlightUpdateMessage, TrackSuccessMessage, DispatchResultMessage, BoardResultMessage, BoardingStartedMessage, PassengerBoardedMessage, NoShowMessage, ErrorMessage } from '../interfaces/socket';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})

/*
  Manages all WebSocket communication between the Angular application and the server

  This service:
  - Establishes and maintains the WebSocket connection.
  - Sends requests to the server
  - Receives and processes incoming messsages
  - Publishes events for Angular components using RxJS Subjects
*/
export class SocketService {
  private socket!: WebSocket;
  private lastPort!: number;

  // Subjects used to broadcast WebSocket events to subsribed components
  flightUpdate$ = new Subject<FlightUpdateMessage>();
  trackingSuccess$ = new Subject<TrackSuccessMessage>();
  dispatchResult$ = new Subject<DispatchResultMessage>();

  boardingStarted$ = new Subject<BoardingStartedMessage>();
  boarded$ = new Subject<PassengerBoardedMessage>();
  boardingResults$ = new Subject<BoardResultMessage>();
  noShow$ = new Subject<NoShowMessage>();
  error$ = new Subject<ErrorMessage>();

  // Processes incoming WebSocket messages and publishes the appropriate events for application components
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
        this.trackingSuccess$.next(msg as TrackSuccessMessage);
        break;

      case 'FLIGHT_UPDATE': // Publish live flight position update.
        console.log('Live update:', msg);
        this.flightUpdate$.next(msg as FlightUpdateMessage);
        break;

      case 'DISPATCH_RESULT': // Publish the result of a Dispatch reques
        console.log('Dispatch result:', msg);
        this.dispatchResult$.next(msg as DispatchResultMessage);
        break;

      case 'BOARDING_STARTED': // Notify subsribers that boarding has started
        console.log('Boarding started:', msg);
        this.boardingStarted$.next(msg as BoardingStartedMessage);
        break;

      case 'PASSENGER_BOARDED': // Notify subsribers that a passenger has boarded
        console.log('Passenger boarded:', msg);
        this.boarded$.next(msg as PassengerBoardedMessage);
        break;

      case 'NO_SHOW': // Notify subscribers that a passenger did not board.
        console.log('Passenger no-show:', msg);
        this.noShow$.next(msg as NoShowMessage);
        break;

      case 'AUTH_FAILED':
        console.error('WebSocket auth failed:', msg.message);
        break;

      case 'ERROR':
        this.error$.next(msg as ErrorMessage);
        console.error('Server error:', this.error$.next(msg));
        break;

      case 'KILLED': // Handle forced server disconnections
        alert(msg.message);
        this.socket.close();
        break;

      default:
        console.log('Unknown message payload:', msg);
    }
  }

  // Establishes a WebSocker connection and authenticates the user.
  connect(apiKey: string, port: number, username: string): void {
    if (!port) { // Ensure a valid port has been supplied
      console.error("Port required");
      return;
    }

    this.lastPort = port;

    const target = `${environment.websocketServer.protocol}://${environment.websocketServer.host}`;
    console.log("Connecting websocket: ", target);

    this.socket = new WebSocket(target); // Create a WebSocket connection

    // Authenticate with the server once the connection opens
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

    // Parse and process all incoming WebSocket messages.
    this.socket.onmessage = (event) => {
      let msg: any;

      try {
        msg = JSON.parse(event.data as string);

        // Immediately publish live flight updates
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

    // Log any connection errors
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  // Sends a message to the server if the socket is connected.
  send(data: any): void {
    console.log('SEND attempt:', data, 'readyState:', this.socket?.readyState);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Socket not open, message dropped:', data);
    }
  }

  // Request live tracking for a flight
  trackFlight(flightId: number): void {
    this.send({ type: 'TRACK', flightId: flightId });
  }

  // Request to board flight
  boardFlight(flightId: number): void {
    this.send({ type: 'BOARD', flightId: flightId });
  }

  // Requests that an ATC dispatch a flight
  dispatchFlight(flightId: number): void {
    this.send({ type: 'DISPATCH', flightId: flightId });
  }

  // Returns whether the WebSocket connection is currently open
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // closes WebSocket connection
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
  }
}

