// Describes the data structures returned by the PHP API.

/*
 * Generic API response wrapper.
 * Every PHP endpoint returns this structure.
 */
export interface ApiResponse<T> {
  status: 'success' | 'error';
  timestamp: number;
  message?: string;
  data?: T;
}

// Airport coordinates.
export interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

//Airport information returned by GetFlight/GetAllFlights.
export interface Airport {
  id: number;
  name: string;
  code: string;
  city: string;
  country: string;
  coordinates: Coordinates;
}

// Passenger information returned when an ATC retrieves a flight.
export interface Passenger {
  id: number;
  username: string;
  email: string;
  seat_number: string;
  status: string;
  booked_at: string;
}

// Authenticated user.
export interface User {
  id: number;
  username: string;
  type: string;
}

// Flight object returned by GetFlight.
export interface Flight {
  id: number;
  flight_number: string;
  departure_time: string;
  flight_duration_hours: number;

  status: string;

  current_position: Coordinates;

  origin: Airport;
  destination: Airport;

  dispatched_at?: string;

  passengers?: Passenger[];
  passenger_count?: number;
}

// Payload returned by GetAllFlights.
export interface FlightsData {
  role: string;
  count: number;
  flights: Flight[];
}

// Payload returned by Login
export interface LoginResponse {
  username: string;
  type: string;
  api_key: string
}
