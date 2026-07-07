import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { ApiResponse, Flight, FlightsData, User, LoginResponse} from '../interfaces/api';

@Injectable ({
  providedIn: 'root'
})

/*
  Provides HTTP communication between the ANgular application and the PHP backend API.

  This service:
  - Authenticates users
  - Retrieves user information
  - Retrieves flight information
  - Parses API responses and handles invalid JSON.
*/
export class ApiService{
 private readonly  API_URL = environment.apiUrl;
  //Encode username:password to Base64

  /*
    Generic Helper.
    Parses an HTTP response and converts it into JSON.
    Throws an error if the server returns invalid JSON.
  */
  private async parseJsonResponse<T>(res: Response): Promise<T> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    }

    catch {
      throw new Error(`Server returned invalid JSON: ${text}`);
    }
  }

  /*
    Authenticates a user using their username and password.
    Throws an error if authentification fails.
  */
  async login(username: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const res = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "Login",
        username,
        password
      })
    });

    if (!res.ok) {
      const text = await res.text();
      let payload: any = null;

      try {
        payload = JSON.parse(text);
      }
      catch {
        payload = null;
      }

      const errorText =
        typeof payload?.data === 'string'
          ? payload.data
          : payload?.message ?? text;

      throw new Error(errorText || `Login failed (${res.status})`);
    }

    return await this.parseJsonResponse<ApiResponse<LoginResponse>>(res);
  }

  // Retrieves information about the currently authenticated user
  async me(apiKey: string): Promise<ApiResponse<User>> {
    const res = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "Me",
        api_key: apiKey
      })
    });

    return await this.parseJsonResponse<ApiResponse<User>>(res);
  }

  // Retrieves all flights that the current user is authorised to view.
  async getFlights(apiKey: string): Promise<ApiResponse<FlightsData>> {
    const res = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "GetAllFlights",
        api_key: apiKey
      })
    });

    return await this.parseJsonResponse<ApiResponse<FlightsData>>(res);
  }

  // Retrieves detailed information for a specific flight.
  async getFlight(apiKey: string, flightId: number): Promise<ApiResponse<Flight>> {
    const res = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "GetFlight",
        api_key: apiKey,
        flight_id: flightId
      })
    });

    return await this.parseJsonResponse<ApiResponse<Flight>>(res);
  }
}

