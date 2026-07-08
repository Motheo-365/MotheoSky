import { ApiResponse } from './api';

export interface FlightUpdateMessage {
    type: 'FLIGHT_UPDATE';
    flightId: number;
    latitude: number;
    longitude: number;
    status: string;
}

export interface TrackSuccessMessage {
    type: 'TRACK_SUCCESS';
    flightId: number;
}

export interface DispatchResultMessage {
    type: 'DISPATCH_RESULT';
    data: ApiResponse<void>;
}

export interface BoardResultMessage {
    type: 'BOARD_RESULT';
    data: ApiResponse<void>;
}

export interface BoardingStartedMessage {
    type: 'BOARDING_STARTED';
    flightId: number;
}

export interface PassengerBoardedMessage {
    type: 'PASSENGER_BOARDED';
    flightId: number;
    passenger: string; // Shows username
}

export interface NoShowMessage {
    type: 'NO_SHOW';
    flightId: number;
    passenger: string; // Shows username
}

export interface ErrorMessage {
    type: 'ERROR';
    message: string;
}
